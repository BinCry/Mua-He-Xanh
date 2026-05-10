/**
 * Workshop Controller - Chương 5.11: Workshop & Trải nghiệm
 * Tham khảo pattern từ Relioo AdminController (CRUD + API JSON responses)
 */
const Workshop = require('../models/Workshop');
const db = require('../core/database');
const NotificationController = require('./NotificationController');

const WorkshopController = {

    // GET /workshops — Danh sách workshop
    index: async (req, res) => {
        try {
            const typeFilter = req.query.type || null;
            let workshops;
            
            if (typeFilter) {
                workshops = await Workshop.getByType(typeFilter);
            } else {
                workshops = await Workshop.getAll(50);
            }

            // Get stats for each workshop
            for (let ws of workshops) {
                ws.stats = await Workshop.getStats(ws.id);
            }

            const typeLabels = {
                nhang: '🪔 Làm Nhang', mai: '🌸 Chăm Mai', thien: '🧘 Thiền Healing',
                banh: '🍰 Bánh Dân Gian', ecology: '🌿 Sinh Thái', culture: '🎭 Văn Hóa', other: '✨ Khác'
            };

            res.render('workshop/index', {
                title: 'Workshop & Trải Nghiệm',
                workshops,
                typeFilter,
                typeLabels
            });
        } catch (error) {
            console.error('Workshop index error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // GET /workshops/:id — Chi tiết workshop + form đăng ký
    show: async (req, res) => {
        try {
            const workshop = await Workshop.getById(req.params.id);
            if (!workshop) {
                return res.status(404).render('errors/404', { title: 'Workshop không tồn tại' });
            }

            const stats = await Workshop.getStats(workshop.id);
            const relatedWorkshops = await Workshop.getByDestination(workshop.destination_id);

            // Get user's bookings for this workshop if logged in
            let userBookings = [];
            if (req.user || req.session.user) {
                const userId = (req.user || req.session.user).id;
                const allBookings = await Workshop.getBookingsByUser(userId);
                userBookings = allBookings.filter(b => b.workshop_id === workshop.id);
            }

            res.render('workshop/show', {
                title: workshop.title,
                workshop,
                stats,
                relatedWorkshops: relatedWorkshops.filter(w => w.id !== workshop.id),
                userBookings
            });
        } catch (error) {
            console.error('Workshop show error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /api/workshop/book — Đặt chỗ workshop (JSON API, pattern Relioo)
    book: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) {
                return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để đặt workshop' });
            }

            const { workshop_id, booking_date, booking_time, num_people, note } = req.body;

            if (!workshop_id || !booking_date) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn ngày tham gia' });
            }

            const workshop = await Workshop.getById(workshop_id);
            if (!workshop) {
                return res.status(404).json({ success: false, message: 'Workshop không tồn tại' });
            }

            const totalPrice = workshop.price * (num_people || 1);

            const booking = await Workshop.createBooking({
                workshop_id,
                user_id: user.id,
                booking_date,
                booking_time: booking_time || '08:00',
                num_people: num_people || 1,
                total_price: totalPrice,
                note
            });

            // Award points for booking
            await db.query(
                'UPDATE users SET total_points = COALESCE(total_points, 0) + 50 WHERE id = ?',
                [user.id]
            );

            // Send notification
            await NotificationController.create(
                user.id, 'workshop',
                `Đặt workshop thành công!`,
                `Bạn đã đăng ký "${workshop.title}". Mã vé: ${booking.qr_ticket}. +50 điểm`,
                '/my-workshops'
            );

            res.json({
                success: true,
                message: `Đặt chỗ thành công! Mã vé QR: ${booking.qr_ticket}`,
                booking: booking
            });
        } catch (error) {
            console.error('Workshop book error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống khi đặt chỗ' });
        }
    },

    // POST /api/workshop/review — Đánh giá sau workshop
    review: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { booking_id, rating, review } = req.body;
            await Workshop.addReview(booking_id, rating, review);

            // Award points for review
            await db.query(
                'UPDATE users SET total_points = COALESCE(total_points, 0) + 30 WHERE id = ?',
                [user.id]
            );

            res.json({ success: true, message: 'Cảm ơn đánh giá của bạn! +30 điểm' });
        } catch (error) {
            console.error('Workshop review error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // GET /my-workshops — Lịch sử đặt chỗ của du khách
    myBookings: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            const bookings = await Workshop.getBookingsByUser(user.id);

            res.render('workshop/my-bookings', {
                title: 'Workshop của tôi',
                bookings
            });
        } catch (error) {
            console.error('My bookings error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    }
};

module.exports = WorkshopController;
