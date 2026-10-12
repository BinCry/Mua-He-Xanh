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
        WORKSHOP_SCHEDULE_LOCKED: 409,
        WORKSHOP_SESSION_HAS_OPEN_BOOKINGS: 409,
        WORKSHOP_HAS_OPEN_BOOKINGS: 409,
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
    return res.status(status).json({
        success: false,
        code,
        message: 'Không thể hoàn tất thao tác Workshop. Vui lòng kiểm tra dữ liệu và thử lại.'
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
                ? db.query('SELECT id, name FROM destinations WHERE is_active = 1 ORDER BY name ASC')
                : db.query('SELECT id, name FROM destinations WHERE id = $1 AND is_active = 1', [destinationId]);
            const [destinations] = await destinationsQuery;
            const allowedDestinationIds = destinations.map(destination => destination.id);
            const selectedDestinationId = destinationId || allowedDestinationIds[0] || null;
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
                            COUNT(b.id) FILTER (WHERE b.status IN ('pending', 'confirmed'))::int AS open_booking_count
                     FROM workshop_sessions ws
                     JOIN workshops w ON w.id = ws.workshop_id
                     LEFT JOIN destinations d ON d.id = w.destination_id
                     LEFT JOIN workshop_session_bookings b ON b.session_id = ws.id
                     WHERE ws.workshop_id = ANY($1::varchar[])
                     GROUP BY ws.id, w.title, w.destination_id, d.name
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
