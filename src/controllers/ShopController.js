const Workshop = require('../models/Workshop');
const db = require('../core/database');
const NotificationController = require('./NotificationController');
const cache = require('../core/cache');
const { v4: uuidv4 } = require('uuid');

const ShopController = {

    // GET /shops - Danh sách sản phẩm Shop
    index: async (req, res) => {
        try {
            const typeFilter = req.query.type || null;
            const searchQuery = req.query.q || '';
            const cacheKey = `shops:list:${typeFilter || 'all'}:${searchQuery || 'none'}`;

            const typeLabels = {
                nhang: '🪔 Làm Nhang', mai: '🌸 Chăm Mai', thien: '🧘 Thiền Healing',
                banh: '🍰 Bánh Dân Gian', ecology: '🌿 Sinh Thái', culture: '🎭 Văn Hóa', other: '✨ Khác'
            };

            // Check in-memory cache
            const cachedData = cache.get(cacheKey);
            if (cachedData) {
                return res.render('shop/index', {
                    title: 'Shop & Sản Phẩm',
                    workshops: cachedData,
                    typeFilter,
                    typeLabels,
                    searchQuery
                });
            }
            
            let workshops;
            let query = `
                SELECT w.*, d.name as destination_name, d.slug as destination_slug
                FROM workshops w
                LEFT JOIN destinations d ON w.destination_id = d.id
                WHERE w.is_active = 1
            `;
            const params = [];
            let index = 1;

            if (typeFilter) {
                query += ` AND w.type = $${index++}`;
                params.push(typeFilter);
            }

            if (searchQuery) {
                const searchLower = searchQuery.toLowerCase().trim();
                let typeMatch = null;
                if (searchLower.includes('nhang')) typeMatch = 'nhang';
                else if (searchLower.includes('mai')) typeMatch = 'mai';
                else if (searchLower.includes('thiền') || searchLower.includes('thien') || searchLower.includes('healing')) typeMatch = 'thien';
                else if (searchLower.includes('bánh') || searchLower.includes('banh')) typeMatch = 'banh';
                else if (searchLower.includes('sinh thái') || searchLower.includes('sinh thai') || searchLower.includes('ecology')) typeMatch = 'ecology';
                else if (searchLower.includes('văn hóa') || searchLower.includes('van hoa') || searchLower.includes('culture')) typeMatch = 'culture';

                if (typeMatch) {
                    const p1 = index++, p2 = index++, p3 = index++;
                    query += ` AND (w.title LIKE $${p1} OR w.description LIKE $${p2} OR w.type = $${p3})`;
                    params.push(`%${searchQuery}%`, `%${searchQuery}%`, typeMatch);
                } else {
                    const p1 = index++, p2 = index++;
                    query += ` AND (w.title LIKE $${p1} OR w.description LIKE $${p2})`;
                    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
                }
            }

            query += ' ORDER BY w.sort_order ASC, w.created_at DESC LIMIT 50';

            const [rows] = await db.query(query, params);
            workshops = rows || [];

            // Parallelize stats queries for fast execution
            const statsPromises = workshops.map(ws => Workshop.getStats(ws.id).catch(() => ({ total_bookings: 0, completed: 0, avg_rating: null, total_participants: 0 })));
            const allStats = await Promise.all(statsPromises);
            workshops.forEach((ws, i) => {
                ws.stats = allStats[i];
            });

            // Cache for 3 minutes
            cache.set(cacheKey, workshops, 60);

            res.render('shop/index', {
                title: 'Shop & Sản Phẩm',
                workshops,
                typeFilter,
                typeLabels,
                searchQuery
            });
        } catch (error) {
            console.error('Shop index error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // GET /shops/:id - Chi tiết sản phẩm + form đặt mua
    show: async (req, res) => {
        try {
            const cacheKey = `shops:item:${req.params.id}`;
            let cachedItem = cache.get(cacheKey);

            if (!cachedItem) {
                const workshop = await Workshop.getById(req.params.id);
                if (!workshop) {
                    return res.status(404).render('errors/404', { title: 'Sản phẩm không tồn tại' });
                }

                const [stats, relatedWorkshops] = await Promise.all([
                    Workshop.getStats(workshop.id).catch(() => null),
                    Workshop.getByDestination(workshop.destination_id).catch(() => [])
                ]);

                cachedItem = { workshop, stats, relatedWorkshops };
                cache.set(cacheKey, cachedItem, 60);
            }

            const { workshop, stats, relatedWorkshops } = cachedItem;

            // Get user's bookings for this workshop if logged in (dynamic per user)
            let userBookings = [];
            const currentUser = req.user || req.session?.user;
            if (currentUser) {
                const allBookings = await Workshop.getBookingsByUser(currentUser.id).catch(() => []);
                userBookings = allBookings.filter(b => b.workshop_id === workshop.id);
            }

            res.render('shop/show', {
                title: workshop.title,
                workshop,
                stats,
                relatedWorkshops: (relatedWorkshops || []).filter(w => w.id !== workshop.id),
                userBookings
            });
        } catch (error) {
            console.error('Shop show error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // GET /api/shop/slots - Kiểm tra số lượng tồn kho
    getSlots: async (req, res) => {
        try {
            const { workshopId, date } = req.query;
            if (!workshopId || !date) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin sản phẩm hoặc ngày.' });
            }
            const workshop = await Workshop.getById(workshopId);
            if (!workshop) {
                return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại.' });
            }
            const bookedSeats = await Workshop.getBookedParticipants(workshopId, date);
            const remaining = Math.max(0, workshop.max_participants - bookedSeats);
            
            res.json({
                success: true,
                total: workshop.max_participants,
                booked: bookedSeats,
                remaining: remaining
            });
        } catch (error) {
            console.error('Shop slots error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống khi kiểm tra số chỗ trống.' });
        }
    },

    // POST /api/shop/book - Đặt mua sản phẩm
    book: async (req, res) => {
        let client;
        try {
            const user = req.user || req.session.user;
            if (!user) {
                return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để đặt mua sản phẩm' });
            }

            const { workshop_id, booking_date, booking_time, num_people, note } = req.body;
            const idempotencyKey = String(req.get('Idempotency-Key') || req.body.idempotency_key || '').trim();

            if (!workshop_id || !booking_date) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày tham gia' });
            }

            const requestedSeats = Number.parseInt(num_people, 10);
            if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
                return res.status(400).json({ success: false, message: 'Thiếu mã chống đặt trùng. Vui lòng tải lại trang và thử lại.' });
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(String(booking_date)) || !Number.isSafeInteger(requestedSeats) || requestedSeats < 1) {
                return res.status(400).json({ success: false, message: 'Ngày hoặc số lượng người không hợp lệ.' });
            }

            client = await db.pgPool.connect();
            await client.query('BEGIN');
            const workshopResult = await client.query(
                'SELECT * FROM workshops WHERE id = $1 AND is_active = 1 FOR UPDATE',
                [workshop_id]
            );
            const workshop = workshopResult.rows[0];
            if (!workshop) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' });
            }

            const priorBooking = await client.query(
                `SELECT id, qr_ticket, workshop_id, booking_date, booking_time, num_people, note
                 FROM workshop_bookings WHERE user_id = $1 AND idempotency_key = $2 FOR UPDATE`,
                [user.id, idempotencyKey]
            );
            if (priorBooking.rowCount > 0) {
                const prior = priorBooking.rows[0];
                const sameIntent = String(prior.workshop_id) === String(workshop_id)
                    && String(prior.booking_date).slice(0, 10) === String(booking_date)
                    && String(prior.booking_time || '08:00') === String(booking_time || '08:00')
                    && Number(prior.num_people) === requestedSeats
                    && String(prior.note || '') === String(note || '');
                if (!sameIntent) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ success: false, message: 'Mã chống đặt trùng đã được dùng cho thông tin khác. Vui lòng tải lại trang.' });
                }
                await client.query('COMMIT');
                return res.json({ success: true, message: 'Đơn đặt chỗ đã được ghi nhận.', booking: { id: prior.id, qr_ticket: prior.qr_ticket }, replayed: true });
            }

            // Serialize capacity check and insert using a row lock on workshop.
            const bookedResult = await client.query(
                "SELECT COALESCE(SUM(num_people), 0) AS total FROM workshop_bookings WHERE workshop_id = $1 AND booking_date = $2 AND status != 'cancelled'",
                [workshop_id, booking_date]
            );
            const bookedSeats = Number(bookedResult.rows[0]?.total || 0);
            const remainingSeats = Number(workshop.max_participants) - bookedSeats;
            
            if (requestedSeats > remainingSeats) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    success: false, 
                    message: `Xin lỗi, sản phẩm đã hết hàng vào ngày này (chỉ còn ${remainingSeats > 0 ? remainingSeats : 0} sản phẩm)` 
                });
            }

            const totalPrice = Number(workshop.price) * requestedSeats;
            const booking = {
                id: uuidv4(),
                qr_ticket: `BLH-WS-${require('crypto').randomBytes(12).toString('hex').toUpperCase()}`
            };
            const inserted = await client.query(`
                INSERT INTO workshop_bookings (id, workshop_id, user_id, booking_date, booking_time, num_people, total_price, qr_ticket, note, idempotency_key, points_awarded)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0)
                ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
                RETURNING id, qr_ticket
            `, [booking.id, workshop_id, user.id, booking_date, booking_time || '08:00', requestedSeats, totalPrice, booking.qr_ticket, note || null, idempotencyKey]);
            if (inserted.rowCount === 0) {
                const existing = await client.query(
                    `SELECT id, qr_ticket, workshop_id, booking_date, booking_time, num_people, note
                     FROM workshop_bookings WHERE user_id = $1 AND idempotency_key = $2`,
                    [user.id, idempotencyKey]
                );
                const prior = existing.rows[0];
                const sameIntent = prior && String(prior.workshop_id) === String(workshop_id)
                    && String(prior.booking_date).slice(0, 10) === String(booking_date)
                    && String(prior.booking_time || '08:00') === String(booking_time || '08:00')
                    && Number(prior.num_people) === requestedSeats
                    && String(prior.note || '') === String(note || '');
                if (!sameIntent) {
                    await client.query('ROLLBACK');
                    return res.status(409).json({ success: false, message: 'Mã chống đặt trùng đã được dùng cho thông tin khác. Vui lòng tải lại trang.' });
                }
                await client.query('COMMIT');
                return res.json({ success: true, message: 'Đơn đặt chỗ đã được ghi nhận.', booking: { id: prior.id, qr_ticket: prior.qr_ticket }, replayed: true });
            }
            booking.id = inserted.rows[0].id;
            booking.qr_ticket = inserted.rows[0].qr_ticket;
            await NotificationController.insertWithClient(
                client, user.id, 'shop',
                'Đã nhận yêu cầu đặt chỗ',
                `Yêu cầu đặt chỗ "${workshop.title}" đã được ghi nhận. Mã đơn: ${booking.qr_ticket}. Điểm thưởng được cộng sau khi hoàn thành dịch vụ.`,
                '/my-shops'
            );
            const managers = await client.query(
                "SELECT id FROM users WHERE role = 'manager' AND managed_destination_id = $1",
                [workshop.destination_id]
            );
            for (const manager of managers.rows) {
                await NotificationController.insertWithClient(
                    client, manager.id, 'shop',
                    'Yêu cầu đặt chỗ mới',
                    `${user.full_name || 'Khách hàng'} gửi yêu cầu "${workshop.title}" (${requestedSeats} người). Mã đơn: ${booking.qr_ticket}`,
                    '/manager/shops'
                );
            }
            await client.query('COMMIT');

            res.json({
                success: true,
                message: `Yêu cầu đặt chỗ đã được ghi nhận. Mã đơn: ${booking.qr_ticket}. Điểm thưởng được cộng sau khi hoàn thành dịch vụ.`,
                booking: booking
            });
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error(`[${req.requestId || 'untracked'}] Shop booking error:`, error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đặt chỗ' });
        } finally {
            client?.release();
        }
    },

    // POST /api/shop/cancel - Hủy đơn đặt mua sản phẩm
    cancel: async (req, res) => {
        let client;
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { bookingId } = req.body;
            if (!bookingId) return res.status(400).json({ success: false, message: 'Thiếu mã đặt chỗ' });

            client = await db.pgPool.connect();
            await client.query('BEGIN');
            const bookingResult = await client.query(
                `SELECT wb.*, w.title AS workshop_title, w.destination_id
                 FROM workshop_bookings wb
                 LEFT JOIN workshops w ON w.id = wb.workshop_id
                 WHERE wb.id = $1 AND wb.user_id = $2
                 FOR UPDATE OF wb`,
                [bookingId, user.id]
            );

            if (bookingResult.rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đặt chỗ của bạn' });
            }

            const booking = bookingResult.rows[0];
            if (booking.status === 'completed' || booking.status === 'cancelled') {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Không thể hủy lịch hẹn ở trạng thái này' });
            }

            const cancelled = await client.query(
                "UPDATE workshop_bookings SET status = 'cancelled', points_awarded = 0 WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'confirmed') RETURNING id",
                [bookingId, user.id]
            );
            if (cancelled.rowCount !== 1) {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, message: 'Đơn đã được cập nhật ở một yêu cầu khác. Vui lòng tải lại.' });
            }

            if (Number(booking.points_awarded) > 0) {
                await client.query(
                    "UPDATE users SET total_points = GREATEST(0, COALESCE(total_points, 0) - 50) WHERE id = $1",
                    [user.id]
                );
            }
            await NotificationController.insertWithClient(
                client, user.id, 'shop',
                'Đã hủy yêu cầu đặt chỗ',
                `Bạn đã hủy yêu cầu "${booking.workshop_title || 'sản phẩm'}".`,
                '/my-shops'
            );
            const managers = await client.query(
                "SELECT id FROM users WHERE role = 'manager' AND managed_destination_id = $1",
                [booking.destination_id]
            );
            for (const manager of managers.rows) {
                await NotificationController.insertWithClient(
                    client, manager.id, 'shop',
                    'Khách hàng hủy yêu cầu đặt chỗ',
                    `${user.full_name || 'Khách hàng'} đã hủy yêu cầu "${booking.workshop_title || 'sản phẩm'}".`,
                    '/manager/shops'
                );
            }
            await client.query('COMMIT');

            res.json({ success: true, message: 'Đã hủy đặt chỗ thành công.' });
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error(`[${req.requestId || 'untracked'}] Shop cancellation error:`, error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống khi hủy đặt chỗ' });
        } finally {
            client?.release();
        }
    },

    // POST /api/shop/review - Đánh giá sản phẩm
    review: async (req, res) => {
        let client;
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { booking_id, rating, review } = req.body;
            const numericRating = Number(rating);
            if (!booking_id || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5 || typeof review !== 'string' || review.trim().length > 2000) {
                return res.status(400).json({ success: false, message: 'Thông tin đánh giá không hợp lệ.' });
            }

            client = await db.pgPool.connect();
            await client.query('BEGIN');
            const updated = await client.query(
                `UPDATE workshop_bookings
                 SET rating = $1, review = $2
                 WHERE id = $3 AND user_id = $4 AND status = 'completed' AND rating IS NULL
                 RETURNING id`,
                [numericRating, review.trim(), booking_id, user.id]
            );
            if (updated.rowCount !== 1) {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, message: 'Đơn không thuộc tài khoản, chưa thể đánh giá hoặc đã được đánh giá.' });
            }
            await client.query(
                'UPDATE users SET total_points = COALESCE(total_points, 0) + 30 WHERE id = $1',
                [user.id]
            );
            await client.query('COMMIT');

            res.json({ success: true, message: 'Cảm ơn đánh giá của bạn! +30 điểm' });
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error('Shop review error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        } finally {
            client?.release();
        }
    },

    // GET /my-shops - Lịch sử đơn hàng của du khách
    myBookings: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            const bookings = await Workshop.getBookingsByUser(user.id);

            res.render('shop/my-bookings', {
                title: 'Đơn hàng Shop của tôi',
                bookings
            });
        } catch (error) {
            console.error('My bookings error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    }
};

module.exports = ShopController;
