const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const UserSession = require('../models/UserSession');
const HomeController = require('./HomeController');
const { v4: uuidv4 } = require('uuid');

class ManagerController {
    async index(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user.managed_destination_id;
            
            if (user.role === 'admin' && req.query.dest_id) {
                destId = req.query.dest_id;
            }

            if (!destId) {
                if (user.role === 'admin') {
                    const allDests = await Destination.findAll();
                    return res.render('manager/admin_list', { 
                        title: 'Quản trị hệ thống', 
                        allDests,
                        layout: 'layouts/admin',
                        adminPage: 'manager'
                    });
                }
                return res.redirect('/auth/login?error=Bạn không có quyền quản lý địa điểm nào');
            }

            const dest = await Destination.findById(destId);
            if (!dest) return res.status(404).send("Địa điểm không tồn tại");

            // 1. Total Check-ins
            const [checkinStats] = await UserSession.db.query(
                "SELECT COUNT(*) as total FROM check_ins WHERE destination_id = $1",
                [dest.id]
            );

            // 2. Total conversations (unique session ids)
            const [convoStats] = await UserSession.db.query(
                "SELECT COUNT(DISTINCT sender_uuid) as total FROM messages WHERE destination_id = $1 AND sender_uuid IS NOT NULL",
                [dest.id]
            );

            // 3. Review ratings stats
            const [reviewStats] = await UserSession.db.query(
                "SELECT COUNT(*) as count, COALESCE(AVG(rating), 5.0) as avg_rating FROM reviews WHERE destination_id = $1",
                [dest.id]
            );

            // 4. Workshop Bookings Count
            const [workshopBookingsCount] = await UserSession.db.query(
                `SELECT COUNT(*) as total FROM workshop_bookings wb 
                 JOIN workshops w ON wb.workshop_id = w.id 
                 WHERE w.destination_id = $1 AND wb.status != 'cancelled'`,
                [dest.id]
            );

            // 5. Revenue
            const [revenueStats] = await UserSession.db.query(
                `SELECT COALESCE(SUM(wb.total_price), 0) as total
                 FROM workshop_bookings wb
                 JOIN workshops w ON wb.workshop_id = w.id
                 WHERE w.destination_id = $1 AND wb.status != 'cancelled'`,
                [dest.id]
            );

            // 1. Daily Check-ins (last 7 days - PostgreSQL INTERVAL)
            const [dailyCheckinRows] = await UserSession.db.query(`
                SELECT DATE(created_at) as day, COUNT(*) as count
                FROM check_ins 
                WHERE destination_id = $1 AND created_at >= NOW() - INTERVAL '7 day'
                GROUP BY DATE(created_at) ORDER BY day ASC
            `, [dest.id]);
            
            const checkinsMap = {};
            dailyCheckinRows.forEach(r => {
                try {
                    const dateStr = new Date(r.day).toISOString().split('T')[0];
                    checkinsMap[dateStr] = parseInt(r.count, 10);
                } catch(e) {}
            });

            const dailyCheckins = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayStr = d.toISOString().split('T')[0];
                dailyCheckins.push({
                    day: dayStr,
                    count: checkinsMap[dayStr] || 0
                });
            }

            // 2. Rating trend (last 7 days - PostgreSQL INTERVAL)
            const [dailyRatingRows] = await UserSession.db.query(`
                SELECT DATE(created_at) as day, AVG(rating) as avg_rating
                FROM reviews
                WHERE destination_id = $1 AND created_at >= NOW() - INTERVAL '7 day'
                GROUP BY DATE(created_at) ORDER BY day ASC
            `, [dest.id]);
            
            const ratingsMap = {};
            dailyRatingRows.forEach(r => {
                try {
                    const dateStr = new Date(r.day).toISOString().split('T')[0];
                    ratingsMap[dateStr] = parseFloat(r.avg_rating || 5.0);
                } catch(e) {}
            });

            const dailyRatings = [];
            let lastRating = 5.0;
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayStr = d.toISOString().split('T')[0];
                if (ratingsMap[dayStr] !== undefined) {
                    lastRating = ratingsMap[dayStr];
                }
                dailyRatings.push({
                    day: dayStr,
                    rating: parseFloat(lastRating).toFixed(1)
                });
            }

            // 1. Recent Check-ins
            const [recentCheckins] = await UserSession.db.query(
                `SELECT c.*, s.uuid as session_uuid, u.full_name, u.avatar 
                 FROM check_ins c
                 LEFT JOIN user_sessions s ON c.session_id = s.id
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE c.destination_id = $1
                 ORDER BY c.created_at DESC LIMIT 5`,
                [dest.id]
            );

            // 2. Recent Reviews
            const [recentReviews] = await UserSession.db.query(
                `SELECT r.id, r.content, r.rating, r.images, r.created_at, u.full_name, u.avatar 
                 FROM (
                     SELECT id
                     FROM reviews
                     WHERE destination_id = $1
                     ORDER BY created_at DESC LIMIT 3
                 ) sub
                 JOIN reviews r ON sub.id = r.id
                 LEFT JOIN users u ON r.user_id = u.id
                 ORDER BY r.created_at DESC`,
                [dest.id]
            );

            res.render('manager/dashboard', {
                title: 'Bảng điều khiển: ' + dest.name,
                dest,
                stats: {
                    checkins: parseInt(checkinStats[0]?.total || 0, 10),
                    chats: parseInt(convoStats[0]?.total || 0, 10),
                    reviewsCount: parseInt(reviewStats[0]?.count || 0, 10),
                    avgRating: parseFloat(reviewStats[0]?.avg_rating || 5.0).toFixed(1),
                    workshopBookings: parseInt(workshopBookingsCount[0]?.total || 0, 10),
                    revenue: parseInt(revenueStats[0]?.total || 0, 10)
                },
                chartData: { dailyCheckins, dailyRatings },
                recentCheckins,
                recentReviews,
                success: req.query.success || null,
                error: req.query.error || null,
                layout: 'layouts/admin',
                managerPage: 'dashboard',
                adminPage: 'manager'
            });
        } catch (error) {
            console.error("Manager index error:", error);
            res.status(500).send("Internal Server Error: " + error.message);
        }
    }


    async chat(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user.managed_destination_id;
            
            if (user.role === 'admin' && req.query.dest_id) {
                destId = req.query.dest_id;
            }

            if (!destId) {
                return res.redirect('/manager');
            }

            const dest = await Destination.findById(destId);
            if (!dest) return res.status(404).send("Địa điểm không tồn tại");

            const [conversations] = await UserSession.db.query(
                `SELECT 
                     sub.session_key AS session_id,
                     sub.session_key AS session_uuid,
                     sub.last_message,
                     sub.last_message_time,
                     COALESCE(u.full_name, 'Du khách #' || SUBSTRING(sub.session_key, 1, 6)) AS user_name,
                     u.avatar AS user_avatar,
                     u.phone AS user_phone,
                     u.email AS user_email,
                     COALESCE(s.total_points, 0) AS visitor_points
                 FROM (
                     SELECT 
                         CASE 
                             WHEN sender_uuid IS NOT NULL AND sender_uuid != '' THEN sender_uuid 
                             ELSE receiver_uuid 
                         END AS session_key,
                         MAX(created_at) AS last_message_time,
                         (
                             SELECT COALESCE(message, content, '')
                             FROM messages m2 
                             WHERE m2.destination_id = $1
                               AND (m2.sender_uuid = CASE WHEN sender_uuid IS NOT NULL AND sender_uuid != '' THEN sender_uuid ELSE receiver_uuid END
                                 OR m2.receiver_uuid = CASE WHEN sender_uuid IS NOT NULL AND sender_uuid != '' THEN sender_uuid ELSE receiver_uuid END)
                             ORDER BY created_at DESC LIMIT 1
                         ) AS last_message
                     FROM messages
                     WHERE destination_id = $1 AND ((sender_uuid IS NOT NULL AND sender_uuid != '') OR (receiver_uuid IS NOT NULL AND receiver_uuid != ''))
                     GROUP BY session_key
                 ) sub
                 LEFT JOIN user_sessions s ON (s.id::text = sub.session_key OR s.uuid = sub.session_key)
                 LEFT JOIN users u ON s.user_id = u.id
                 ORDER BY sub.last_message_time DESC`,
                [dest.id]
            );

            res.render('manager/chat', {
                title: 'Hộp thư Hỗ trợ: ' + dest.name,
                dest,
                conversations,
                layout: 'layouts/admin',
                managerPage: 'chat',
                adminPage: 'manager'
            });
        } catch (error) {
            console.error("Manager chat error:", error);
            res.status(500).send("Internal Server Error: " + error.message);
        }
    }

    async destination(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user.managed_destination_id;
            
            if (user.role === 'admin' && req.query.dest_id) {
                destId = req.query.dest_id;
            }

            if (!destId) {
                return res.redirect('/manager');
            }

            const dest = await Destination.findById(destId);
            if (!dest) return res.status(404).send("Địa điểm không tồn tại");

            res.render('manager/destination', {
                title: 'Cấu hình địa điểm: ' + dest.name,
                dest,
                success: req.query.success || null,
                error: req.query.error || null,
                layout: 'layouts/admin',
                managerPage: 'destination',
                adminPage: 'manager'
            });
        } catch (error) {
            console.error("Manager destination error:", error);
            res.status(500).send("Internal Server Error: " + error.message);
        }
    }

    async getChatHistory(req, res) {
        try {
            const { sessionId } = req.query;
            const manager = req.session.user || req.user;
            let destId = manager.managed_destination_id;

            if (manager.role === 'admin' && req.query.dest_id) {
                destId = req.query.dest_id;
            }

            if (!sessionId || !destId) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin session hoặc địa điểm.' });
            }

            const [visitorDetails] = await UserSession.db.query(
                `SELECT s.id, s.uuid, s.total_points, u.full_name, u.avatar, u.email, u.phone,
                        (SELECT COUNT(*) FROM check_ins ci WHERE (ci.session_id = s.id OR (u.id IS NOT NULL AND ci.user_id = u.id)) AND ci.destination_id = $2) as is_checked_in
                 FROM user_sessions s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.id::text = $1 OR s.uuid = $1`,
                [String(sessionId), destId]
            );

            const visitor = visitorDetails[0] || {
                id: sessionId,
                uuid: sessionId,
                full_name: 'Du khách #' + String(sessionId).slice(0, 6).toUpperCase(),
                total_points: 0,
                is_checked_in: 0
            };

            const [messages] = await UserSession.db.query(
                `SELECT m.id, m.sender_id, m.sender_uuid, m.receiver_uuid, m.destination_id, COALESCE(m.message, m.content, '') as message, m.is_ai, m.created_at,
                        u.full_name as sender_name, u.avatar as sender_avatar,
                        mgr.full_name as manager_name
                 FROM messages m
                 LEFT JOIN user_sessions s ON m.sender_uuid = s.id::text OR m.sender_uuid = s.uuid
                 LEFT JOIN users u ON s.user_id = u.id
                 LEFT JOIN users mgr ON m.sender_id = mgr.id
                 WHERE m.destination_id = $1 
                   AND (m.sender_uuid = $2 OR m.receiver_uuid = $2)
                 ORDER BY m.created_at ASC`,
                [destId, String(sessionId)]
            );

            res.json({
                success: true,
                messages,
                visitor
            });
        } catch (error) {
            console.error("Fetch chat history error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateDestination(req, res) {
        try {
            const user = req.session.user || req.user;
            if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
                return res.status(403).json({ success: false, message: 'Chỉ Admin hoặc Quản lý mới có quyền cập nhật thông tin địa điểm.' });
            }

            const { dest_id, open_hours, cost, cover_image, highlight, description, checkin_tip, story, zen_walk_desc, best_time, short_desc } = req.body;
            
            let targetDestId = dest_id;
            if (user.role === 'manager') {
                targetDestId = user.managed_destination_id;
            }

            if (!targetDestId) {
                return res.redirect('/manager/destination?error=' + encodeURIComponent('Không xác định được địa điểm cần cập nhật'));
            }

            const updateData = {};
            if (typeof open_hours !== 'undefined') updateData.open_hours = open_hours || '';
            if (typeof cost !== 'undefined') updateData.cost = cost || '';
            if (typeof cover_image !== 'undefined') updateData.cover_image = cover_image || '';
            if (typeof highlight !== 'undefined') updateData.highlight = highlight || '';
            if (typeof description !== 'undefined') updateData.description = description || '';
            if (typeof checkin_tip !== 'undefined') updateData.checkin_tip = checkin_tip || '';
            if (typeof story !== 'undefined') updateData.story = story || '';
            if (typeof zen_walk_desc !== 'undefined') updateData.zen_walk_desc = zen_walk_desc || '';
            if (typeof best_time !== 'undefined') updateData.best_time = best_time || '';
            if (typeof short_desc !== 'undefined') updateData.short_desc = short_desc || '';

            await Destination.update(targetDestId, updateData);
            HomeController.clearCache();

            if (typeof cover_image !== 'undefined' && cover_image && cover_image.trim() !== '') {
                const db = require('../core/database');
                await db.query("UPDATE users SET avatar = $1 WHERE role = 'manager' AND managed_destination_id = $2", [cover_image, targetDestId]);
                if (user.role === 'manager' && req.session.user) {
                    req.session.user.avatar = cover_image;
                }
            }

            if (user.role === 'admin') {
                res.redirect(`/manager/destination?dest_id=${targetDestId}&success=${encodeURIComponent('Đã cập nhật thông tin địa điểm')}`);
            } else {
                res.redirect('/manager/destination?success=' + encodeURIComponent('Đã cập nhật thông tin địa điểm'));
            }
        } catch (error) {
            console.error("Update Destination Error:", error);
            res.redirect('/manager/destination?error=' + encodeURIComponent(error.message));
        }
    }

    async workshops(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user.managed_destination_id;
            
            if (user.role === 'admin' && req.query.dest_id) {
                destId = req.query.dest_id;
            }

            if (!destId) {
                return res.redirect('/manager');
            }

            const dest = await Destination.findById(destId);
            if (!dest) return res.status(404).send("Địa điểm không tồn tại");

            const [workshops] = await UserSession.db.query(`
                SELECT w.*, d.name as destination_name,
                       (SELECT COUNT(*) FROM workshop_bookings wb WHERE wb.workshop_id = w.id AND wb.status != 'cancelled') as booking_count
                FROM workshops w 
                LEFT JOIN destinations d ON w.destination_id = d.id
                WHERE w.destination_id = $1
                ORDER BY w.created_at DESC
            `, [dest.id]);

            res.render('manager/workshops', {
                title: 'Quản lý Shop: ' + dest.name,
                dest,
                workshops,
                layout: 'layouts/admin',
                managerPage: 'workshops',
                adminPage: 'manager'
            });
        } catch (error) {
            console.error("Manager workshops view error:", error);
            res.status(500).send("Internal Server Error: " + error.message);
        }
    }

    async createWorkshop(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user?.managed_destination_id || null;

            if (user && user.role === 'admin') {
                destId = req.body.destination_id || destId;
                if (!destId) {
                    const [firstDest] = await UserSession.db.query(
                        "SELECT id FROM destinations WHERE is_active = 1 ORDER BY sort_order ASC LIMIT 1"
                    );
                    destId = firstDest[0]?.id || null;
                }
            }

            if (!destId) {
                return res.status(400).json({ success: false, message: 'Chưa có địa điểm nào trong hệ thống.' });
            }

            let { title, description, type, price, duration, max_participants, image, start_date, end_date } = req.body;
            if (!title) {
                return res.status(400).json({ success: false, message: 'Tên sản phẩm là bắt buộc.' });
            }

            // Direct upload support if image file was attached
            if (req.file) {
                try {
                    const { uploadToCloudinary } = require('../config/cloudinary');
                    const uploadRes = await uploadToCloudinary(req.file.path, 'binh-loi/workshops');
                    image = uploadRes.url;
                } catch (imgErr) {
                    console.error("Workshop image upload error:", imgErr);
                }
            }

            const priceInt = parseInt(price, 10) || 0;
            const maxParticipantsInt = parseInt(max_participants, 10) || 20;

            await UserSession.db.query(
                `INSERT INTO workshops (id, destination_id, title, description, type, price, max_participants, duration, image, start_date, end_date, is_active, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, NOW())`,
                [uuidv4(), destId, title, description || '', type || 'other', priceInt, maxParticipantsInt, duration || '2 giờ', image || '/uploads/posters/poster-1.webp', start_date || null, end_date || null]
            );

            res.json({ success: true, message: 'Đã tạo sản phẩm thành công!' });
        } catch (error) {
            console.error("Manager create shop product error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateWorkshop(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user?.managed_destination_id;
            
            let { id, title, description, type, price, duration, max_participants, image, start_date, end_date, is_active } = req.body;
            if (!id) {
                return res.status(400).json({ success: false, message: 'Thiếu mã sản phẩm.' });
            }

            const [check] = await UserSession.db.query(
                "SELECT destination_id, image FROM workshops WHERE id = $1",
                [id]
            );

            if (check.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
            }

            if (user.role !== 'admin' && check[0].destination_id !== destId) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa sản phẩm này.' });
            }

            // Direct upload support if image file was attached
            if (req.file) {
                try {
                    const { uploadToCloudinary } = require('../config/cloudinary');
                    const uploadRes = await uploadToCloudinary(req.file.path, 'binh-loi/workshops');
                    image = uploadRes.url;
                } catch (imgErr) {
                    console.error("Workshop image update error:", imgErr);
                }
            }
            if (!image) {
                image = check[0].image || '/uploads/posters/poster-1.webp';
            }

            const priceInt = parseInt(price, 10) || 0;
            const maxParticipantsInt = parseInt(max_participants, 10) || 20;
            const isActiveInt = (is_active === false || is_active === 'false' || is_active === 0 || is_active === '0' || is_active === 'off') ? 0 : 1;

            await UserSession.db.query(
                `UPDATE workshops 
                 SET title = $1, description = $2, type = $3, price = $4, duration = $5, max_participants = $6, image = $7, start_date = $8, end_date = $9, is_active = $10 
                 WHERE id = $11`,
                [title, description || '', type || 'other', priceInt, duration || 'Hộp / Chiếc', maxParticipantsInt, image, start_date || null, end_date || null, isActiveInt, id]
            );

            res.json({ success: true, message: 'Cập nhật sản phẩm thành công!' });
        } catch (error) {
            console.error("Manager update shop product error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deleteWorkshop(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user.managed_destination_id;
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, message: 'Thiếu mã sản phẩm.' });
            }

            const [check] = await UserSession.db.query(
                "SELECT destination_id FROM workshops WHERE id = $1",
                [id]
            );

            if (check.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm.' });
            }

            if (user.role !== 'admin' && check[0].destination_id !== destId) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa sản phẩm này.' });
            }

            await UserSession.db.query("DELETE FROM workshops WHERE id = $1", [id]);
            res.json({ success: true, message: 'Đã xóa sản phẩm.' });
        } catch (error) {
            console.error("Manager delete shop product error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getWorkshopBookings(req, res) {
        try {
            const { workshop_id } = req.query;
            if (!workshop_id) {
                return res.status(400).json({ success: false, message: 'Thiếu mã sản phẩm' });
            }
            const [bookings] = await UserSession.db.query(`
                SELECT wb.*, u.full_name, u.email, u.phone, u.avatar
                FROM workshop_bookings wb
                LEFT JOIN users u ON wb.user_id = u.id
                WHERE wb.workshop_id = $1
                ORDER BY wb.created_at DESC
            `, [workshop_id]);
            res.json({ success: true, bookings });
        } catch (error) {
            console.error("Manager getWorkshopBookings error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateBookingStatus(req, res) {
        try {
            const { booking_id, status } = req.body;
            if (!booking_id || !status) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin' });
            }
            await UserSession.db.query(
                "UPDATE workshop_bookings SET status = $1 WHERE id = $2",
                [status, booking_id]
            );
            res.json({ success: true, message: 'Cập nhật trạng thái thành công!' });
        } catch (error) {
            console.error("Manager updateBookingStatus error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ManagerController();
