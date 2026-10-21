const db = require('../core/database');
const { WorkshopManagementService } = require('../services/WorkshopManagementService');

function actor(req) {
    return req.user || req.session?.user || null;
}

function isAdmin(user) {
    return user && (user.role === 'admin' || Number(user.role_id) === 1);
}

function scopeDestination(user, requestedDestinationId) {
    if (isAdmin(user)) return String(requestedDestinationId || '').trim() || null;
    return user?.managed_destination_id || null;
}

function strictBoolean(value) {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    const error = new Error('INVALID_WORKSHOP_STATUS');
    error.code = 'INVALID_WORKSHOP_STATUS';
    throw error;
}

function managementError(res, error) {
    const code = error?.code || 'WORKSHOP_MANAGEMENT_FAILED';
    const status = ({
        WORKSHOP_MANAGEMENT_FORBIDDEN: 403,
        WORKSHOP_NOT_FOUND: 404,
        WORKSHOP_UNAVAILABLE: 409,
        WORKSHOP_DESTINATION_UNAVAILABLE: 404,
        WORKSHOP_SESSION_LOCKED: 409,
        WORKSHOP_SESSION_ALREADY_STARTED: 409,
        WORKSHOP_CAPACITY_BELOW_RESERVED: 409,
        IDEMPOTENCY_PAYLOAD_CONFLICT: 409,
        IDEMPOTENCY_IN_PROGRESS: 409,
        IDEMPOTENCY_KEY_REQUIRED: 400,
        INVALID_WORKSHOP_TITLE: 400,
        INVALID_WORKSHOP_DESCRIPTION: 400,
        INVALID_WORKSHOP_PRICE: 400,
        INVALID_WORKSHOP_CAPACITY: 400,
        INVALID_WORKSHOP_TIME: 400,
        INVALID_WORKSHOP_STATUS: 400,
        WORKSHOP_DESTINATION_REQUIRED: 400
    })[code] || 500;
    if (status === 500) console.error('Workshop management operation failed:', error);
    const message = ({
        WORKSHOP_MANAGEMENT_FORBIDDEN: 'Bạn không có quyền quản lý Workshop hoặc địa điểm này.',
        WORKSHOP_NOT_FOUND: 'Không tìm thấy Workshop hoặc ca Workshop.',
        WORKSHOP_UNAVAILABLE: 'Workshop đang bị ẩn nên không thể tạo ca mới.',
        WORKSHOP_DESTINATION_UNAVAILABLE: 'Địa điểm không tồn tại hoặc đã ngừng hoạt động.',
        WORKSHOP_SESSION_LOCKED: 'Ca đã bắt đầu nên chỉ có thể đóng đăng ký; không thể đổi lịch, giá hoặc sức chứa.',
        WORKSHOP_SESSION_ALREADY_STARTED: 'Ca đã bắt đầu hoặc kết thúc nên không thể mở lại đăng ký.',
        WORKSHOP_CAPACITY_BELOW_RESERVED: 'Sức chứa không thể thấp hơn số chỗ đang được giữ.',
        INVALID_WORKSHOP_TIME: 'Thời gian ca không hợp lệ. Ca mới hoặc ca được đổi lịch phải bắt đầu trong tương lai.',
        INVALID_WORKSHOP_PRICE: 'Giá Workshop không hợp lệ.',
        INVALID_WORKSHOP_CAPACITY: 'Sức chứa Workshop phải từ 1 đến 10.000.',
        INVALID_WORKSHOP_STATUS: 'Trạng thái Workshop không hợp lệ.',
        INVALID_WORKSHOP_TITLE: 'Tên Workshop không hợp lệ.',
        INVALID_WORKSHOP_DESCRIPTION: 'Mô tả Workshop quá dài.',
        WORKSHOP_DESTINATION_REQUIRED: 'Vui lòng chọn địa điểm.',
        IDEMPOTENCY_KEY_REQUIRED: 'Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.'
    })[code] || 'Không thể hoàn tất thao tác Workshop. Vui lòng kiểm tra dữ liệu và thử lại.';
    return res.status(status).json({
        success: false,
        code,
        message
    });
}

class WorkshopManagementController {
    async index(req, res) {
        try {
            const user = actor(req);
            const destinationId = scopeDestination(user, req.query.destination);
            if (!isAdmin(user) && !destinationId) {
                return res.status(403).render('errors/403', { title: 'Không có địa điểm được phân công' });
            }
            const destinationsQuery = isAdmin(user)
                ? db.query('SELECT id, name, is_active FROM destinations ORDER BY is_active DESC, name ASC')
                : db.query('SELECT id, name, is_active FROM destinations WHERE id = $1', [destinationId]);
            const [destinations] = await destinationsQuery;
            const allowedDestinationIds = destinations.map(destination => destination.id);
            const selectedDestinationId = destinationId || allowedDestinationIds[0] || null;
            const selectedDestination = destinations.find(destination => String(destination.id) === String(selectedDestinationId));
            const params = [];
            let where = "WHERE w.catalog_kind = 'workshop'";
            if (selectedDestinationId) {
                params.push(selectedDestinationId);
                where += ' AND w.destination_id = $1';
            } else if (!isAdmin(user)) {
                where += ' AND FALSE';
            }
            const [workshops] = await db.query(
                `SELECT w.id, w.title, w.description, w.destination_id, w.is_active, d.name AS destination_name,
                        COUNT(ws.id)::int AS session_count,
                        COUNT(ws.id) FILTER (WHERE ws.is_active = TRUE AND ws.starts_at > NOW())::int AS upcoming_session_count
                 FROM workshops w
                 LEFT JOIN destinations d ON d.id = w.destination_id
                 LEFT JOIN workshop_sessions ws ON ws.workshop_id = w.id
                 ${where}
                 GROUP BY w.id, d.name
                 ORDER BY w.created_at DESC`,
                params
            );
            const workshopIds = workshops.map(workshop => workshop.id);
            let sessions = [];
            let bookings = [];
            if (workshopIds.length) {
                [sessions] = await db.query(
                    `SELECT ws.*, w.title AS workshop_title, w.destination_id, d.name AS destination_name,
                            CASE
                                WHEN ws.ends_at <= NOW() THEN 'ended'
                                WHEN ws.starts_at <= NOW() THEN 'in_progress'
                                WHEN w.is_active <> 1 THEN 'workshop_hidden'
                                WHEN COALESCE(d.is_active, 0) <> 1 THEN 'destination_inactive'
                                WHEN ws.is_active = TRUE THEN 'open'
                                ELSE 'closed'
                            END AS lifecycle_status,
                            COUNT(b.id) FILTER (WHERE b.status IN ('pending', 'confirmed'))::int AS open_booking_count
                     FROM workshop_sessions ws
                     JOIN workshops w ON w.id = ws.workshop_id
                     LEFT JOIN destinations d ON d.id = w.destination_id
                     LEFT JOIN workshop_session_bookings b ON b.session_id = ws.id
                     WHERE ws.workshop_id = ANY($1::varchar[])
                     GROUP BY ws.id, w.title, w.destination_id, w.is_active, d.name, d.is_active
                     ORDER BY ws.starts_at ASC`,
                    [workshopIds]
                );
                [bookings] = await db.query(
                    `SELECT b.id, b.session_id, b.seats, b.status, b.created_at, b.confirmed_at, b.completed_at, b.cancelled_at,
                            b.title_snapshot, b.price_vnd_snapshot, u.full_name, u.email, w.title AS workshop_title,
                            ws.starts_at, ws.ends_at
                     FROM workshop_session_bookings b
                     JOIN workshop_sessions ws ON ws.id = b.session_id
                     JOIN workshops w ON w.id = ws.workshop_id
                     LEFT JOIN users u ON u.id = b.user_id
                     WHERE ws.workshop_id = ANY($1::varchar[])
                     ORDER BY b.created_at DESC
                     LIMIT 100`,
                    [workshopIds]
                );
            }
            return res.render('workshop-management/index', {
                title: 'Quản lý Workshop',
                layout: 'layouts/admin',
                adminPage: isAdmin(user) ? 'workshops' : undefined,
                managerPage: isAdmin(user) ? undefined : 'workshops',
                destinations,
                selectedDestinationId,
                selectedDestinationActive: Boolean(selectedDestination?.is_active),
                workshops,
                sessions,
                bookings,
                canChooseDestination: isAdmin(user),
                isAdmin: isAdmin(user)
            });
        } catch (error) {
            console.error('Workshop management page failed:', error);
            return res.status(500).render('errors/500', { title: 'Lỗi hệ thống' });
        }
    }

    async createWorkshop(req, res) {
        try {
            const result = await WorkshopManagementService.createWorkshop({
                actor: actor(req),
                destinationId: req.body?.destinationId,
                title: req.body?.title,
                description: req.body?.description,
                idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotencyKey
            });
            return res.status(result.replay ? 200 : 201).json(result);
        } catch (error) {
            return managementError(res, error);
        }
    }

    async createSession(req, res) {
        try {
            const result = await WorkshopManagementService.createSession({
                actor: actor(req),
                workshopId: req.body?.workshopId,
                startsAt: req.body?.startsAt,
                endsAt: req.body?.endsAt,
                priceVnd: req.body?.priceVnd,
                capacity: req.body?.capacity,
                idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotencyKey
            });
            return res.status(result.replay ? 200 : 201).json(result);
        } catch (error) {
            return managementError(res, error);
        }
    }

    async updateWorkshop(req, res) {
        try {
            const result = await WorkshopManagementService.updateWorkshop({
                actor: actor(req), workshopId: req.params.id,
                title: req.body?.title, description: req.body?.description, isActive: strictBoolean(req.body?.isActive)
            });
            return res.json(result);
        } catch (error) {
            return managementError(res, error);
        }
    }

    async updateSession(req, res) {
        try {
            const result = await WorkshopManagementService.updateSession({
                actor: actor(req), sessionId: req.params.id,
                startsAt: req.body?.startsAt, endsAt: req.body?.endsAt,
                priceVnd: req.body?.priceVnd, capacity: req.body?.capacity, isActive: strictBoolean(req.body?.isActive)
            });
            return res.json(result);
        } catch (error) {
            return managementError(res, error);
        }
    }
}

module.exports = new WorkshopManagementController();
