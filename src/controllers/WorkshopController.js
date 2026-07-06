/**
 * Workshop Controller - Chương 5.11: Workshop & Trải nghiệm
 * Tham khảo pattern từ Relioo AdminController (CRUD + API JSON responses)
 */
const Workshop = require('../models/Workshop');
const db = require('../core/database');
const NotificationController = require('./NotificationController');

const WorkshopController = {

    // GET /workshops - Danh sách workshop
    index: async (req, res) => {
        try {
            const typeFilter = req.query.type || null;
            const searchQuery = req.query.q || '';
            let workshops;
            
            let query = `
                SELECT w.*, d.name as destination_name, d.slug as destination_slug
                FROM workshops w
                LEFT JOIN destinations d ON w.destination_id = d.id
                WHERE w.is_active = TRUE
            `;
            const params = [];

            if (typeFilter) {
                query += ' AND w.type = ?';
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
                    query += ' AND (w.title LIKE ? OR w.description LIKE ? OR w.type = ?)';
                    params.push(`%${searchQuery}%`, `%${searchQuery}%`, typeMatch);
                } else {
                    query += ' AND (w.title LIKE ? OR w.description LIKE ?)';
                    params.push(`%${searchQuery}%`, `%${searchQuery}%`);
                }
            }

            query += ' ORDER BY w.sort_order ASC, w.created_at DESC LIMIT 50';

            const [rows] = await db.query(query, params);
            workshops = rows;

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
                typeLabels,
                searchQuery
            });
        } catch (error) {
            console.error('Workshop index error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },


    // GET /workshops/:id - Chi tiết workshop + form đăng ký
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
    // GET /api/workshop/slots - Kiểm tra số chỗ trống
    getSlots: async (req, res) => {
        try {
            const { workshopId, date } = req.query;
            if (!workshopId || !date) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin workshop hoặc ngày.' });
            }
            const workshop = await Workshop.getById(workshopId);
            if (!workshop) {
                return res.status(404).json({ success: false, message: 'Workshop không tồn tại.' });
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
            console.error('Workshop slots error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống khi kiểm tra số chỗ trống.' });
        }
    },

    // POST /api/workshop/book - Đặt chỗ workshop (JSON API, pattern Relioo)
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

            // Check capacity
            const requestedSeats = parseInt(num_people || 1, 10);
            const bookedSeats = await Workshop.getBookedParticipants(workshop_id, booking_date);
            const remainingSeats = workshop.max_participants - bookedSeats;
            
            if (bookedSeats + requestedSeats > workshop.max_participants) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Xin lỗi, lớp học đã đạt giới hạn người tham gia vào ngày này (chỉ còn ${remainingSeats > 0 ? remainingSeats : 0} chỗ trống)` 
                });
            }

            const totalPrice = workshop.price * requestedSeats;

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

    // POST /api/workshop/cancel - Hủy đặt chỗ workshop
    cancel: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { bookingId } = req.body;
            if (!bookingId) return res.status(400).json({ success: false, message: 'Thiếu mã đặt chỗ' });

            // Fetch booking
            const [bookings] = await db.query(
                "SELECT wb.*, w.title as workshop_title FROM workshop_bookings wb LEFT JOIN workshops w ON wb.workshop_id = w.id WHERE wb.id = ? AND wb.user_id = ?",
                [bookingId, user.id]
            );

            if (bookings.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đặt chỗ của bạn' });
            }

            const booking = bookings[0];
            if (booking.status === 'completed' || booking.status === 'cancelled') {
                return res.status(400).json({ success: false, message: 'Không thể hủy lịch hẹn ở trạng thái này' });
            }

            // Update status to cancelled
            await db.query(
                "UPDATE workshop_bookings SET status = 'cancelled' WHERE id = ?",
                [bookingId]
            );

            // Deduct points
            await db.query(
                "UPDATE users SET total_points = GREATEST(0, COALESCE(total_points, 0) - 50) WHERE id = ?",
                [user.id]
            );

            // Send notification
            await NotificationController.create(
                user.id, 'workshop',
                `Đã hủy đặt workshop`,
                `Bạn đã hủy đăng ký "${booking.workshop_title || 'workshop'}". Điểm thưởng trừ 50đ.`,
                '/my-workshops'
            );

            res.json({ success: true, message: 'Đã hủy đặt chỗ thành công.' });
        } catch (error) {
            console.error('Workshop cancel error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống khi hủy đặt chỗ' });
        }
    },

    // POST /api/workshop/review - Đánh giá sau workshop
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

    // GET /my-workshops - Lịch sử đặt chỗ của du khách
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
