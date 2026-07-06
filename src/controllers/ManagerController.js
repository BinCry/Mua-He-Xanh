const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');

class ManagerController {
    async index(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user.managed_destination_id;
            
            // Admin can override destId via query
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

            // --- Stats queries ---
            // 1. Total Check-ins
            const [checkinStats] = await UserSession.db.query(
                "SELECT COUNT(*) as total FROM check_ins WHERE destination_id = ?",
                [dest.id]
            );

            // 2. Total conversations (unique session ids)
            const [convoStats] = await UserSession.db.query(
                "SELECT COUNT(DISTINCT sender_uuid) as total FROM messages WHERE destination_id = ? AND sender_uuid IS NOT NULL",
                [dest.id]
            );

            // 3. Review ratings stats
            const [reviewStats] = await UserSession.db.query(
                "SELECT COUNT(*) as count, COALESCE(AVG(rating), 5.0) as avg_rating FROM reviews WHERE destination_id = ?",
                [dest.id]
            );

            // 4. Workshop Bookings Count (thay cho page views)
            const [workshopBookingsCount] = await UserSession.db.query(
                `SELECT COUNT(*) as total FROM workshop_bookings wb 
                 JOIN workshops w ON wb.workshop_id = w.id 
                 WHERE w.destination_id = ? AND wb.status != 'cancelled'`,
                [dest.id]
            );

            // 5. Doanh thu (Revenue)
            const [revenueStats] = await UserSession.db.query(
                `SELECT COALESCE(SUM(wb.total_price), 0) as total
                 FROM workshop_bookings wb
                 JOIN workshops w ON wb.workshop_id = w.id
                 WHERE w.destination_id = ? AND wb.status != 'cancelled'`,
                [dest.id]
            );

            // --- Charts Data Queries ---
            // 1. Daily Check-ins (last 7 days)
            const [dailyCheckinRows] = await UserSession.db.query(`
                SELECT DATE(created_at) as day, COUNT(*) as count
                FROM check_ins 
                WHERE destination_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY day ORDER BY day ASC
            `, [dest.id]);
            
            const checkinsMap = {};
            dailyCheckinRows.forEach(r => {
                try {
                    const dateStr = new Date(r.day).toISOString().split('T')[0];
                    checkinsMap[dateStr] = r.count;
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

            // 2. Rating trend (last 7 days)
            const [dailyRatingRows] = await UserSession.db.query(`
                SELECT DATE(created_at) as day, AVG(rating) as avg_rating
                FROM reviews
                WHERE destination_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY day ORDER BY day ASC
            `, [dest.id]);
            
            const ratingsMap = {};
            dailyRatingRows.forEach(r => {
                try {
                    const dateStr = new Date(r.day).toISOString().split('T')[0];
                    ratingsMap[dateStr] = parseFloat(r.avg_rating || 5.0);
                } catch(e) {}
            });

            const dailyRatings = [];
            let lastRating = 5.0; // fallback rating
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

            // --- Dashboard Data Lists ---
            // 1. Recent Check-ins
            const [recentCheckins] = await UserSession.db.query(
                `SELECT c.*, s.uuid as session_uuid, u.full_name, u.avatar 
                 FROM check_ins c
                 LEFT JOIN user_sessions s ON c.session_id = s.id
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE c.destination_id = ?
                 ORDER BY c.created_at DESC LIMIT 5`,
                [dest.id]
            );

            // 2. Recent Reviews
            const [recentReviews] = await UserSession.db.query(
                `SELECT r.id, r.content, r.rating, r.images, r.created_at, u.full_name, u.avatar 
                 FROM (
                     SELECT id
                     FROM reviews
                     WHERE destination_id = ?
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
                    checkins: checkinStats[0].total,
                    chats: convoStats[0].total,
                    reviewsCount: reviewStats[0].count,
                    avgRating: parseFloat(reviewStats[0].avg_rating).toFixed(1),
                    workshopBookings: workshopBookingsCount[0].total,
                    revenue: revenueStats[0].total
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

            // Conversation List (Facebook Fanpage style)
            const [conversations] = await UserSession.db.query(
                `SELECT 
                     s.id AS session_id,
                     s.uuid AS session_uuid,
                     s.total_points AS visitor_points,
                     u.full_name AS user_name,
                     u.avatar AS user_avatar,
                     u.phone AS user_phone,
                     u.email AS user_email,
                     (
                         SELECT message 
                         FROM messages 
                         WHERE destination_id = ? 
                           AND (sender_uuid = s.id OR receiver_uuid = s.id)
                         ORDER BY created_at DESC LIMIT 1
                     ) AS last_message,
                     (
                         SELECT created_at 
                         FROM messages 
                         WHERE destination_id = ? 
                           AND (sender_uuid = s.id OR receiver_uuid = s.id)
                         ORDER BY created_at DESC LIMIT 1
                     ) AS last_message_time
                 FROM user_sessions s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.id IN (
                     SELECT DISTINCT sender_uuid FROM messages WHERE destination_id = ? AND sender_uuid IS NOT NULL
                 )
                 ORDER BY last_message_time DESC`,
                [dest.id, dest.id, dest.id]
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

    /** AJAX Endpoint to fetch chat history for a session */
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

            // Fetch chat history
            const [messages] = await UserSession.db.query(
                `SELECT m.*, s.uuid as sender_uuid, 
                        u.full_name as sender_name, u.avatar as sender_avatar,
                        mgr.full_name as manager_name
                 FROM messages m
                 LEFT JOIN user_sessions s ON m.sender_uuid = s.id
                 LEFT JOIN users u ON s.user_id = u.id
                 LEFT JOIN users mgr ON m.sender_id = mgr.id
                 WHERE m.destination_id = ? 
                   AND (m.sender_uuid = ? OR m.receiver_uuid = ?)
                 ORDER BY m.created_at ASC`,
                [destId, sessionId, sessionId]
            );

            // Fetch visitor details
            const [visitorDetails] = await UserSession.db.query(
                `SELECT s.id, s.uuid, s.total_points, u.full_name, u.avatar, u.email, u.phone,
                        (SELECT COUNT(*) FROM check_ins WHERE session_id = s.id AND destination_id = ?) as is_checked_in,
                        (SELECT created_at FROM check_ins WHERE session_id = s.id AND destination_id = ? ORDER BY created_at DESC LIMIT 1) as checked_in_at
                 FROM user_sessions s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.id = ?`,
                [destId, destId, sessionId]
            );

            res.json({
                success: true,
                messages,
                visitor: visitorDetails[0] || null
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

            if (typeof cover_image !== 'undefined' && cover_image && cover_image.trim() !== '') {
                const db = require('../core/database');
                await db.query("UPDATE users SET avatar = ? WHERE role = 'manager' AND managed_destination_id = ?", [cover_image, targetDestId]);
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
                SELECT w.*, d.name as destination_name
                FROM workshops w 
                LEFT JOIN destinations d ON w.destination_id = d.id
                WHERE w.destination_id = ?
                ORDER BY w.created_at DESC
            `, [dest.id]);

            res.render('manager/workshops', {
                title: 'Quản lý Workshop: ' + dest.name,
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
            let destId = user.managed_destination_id;
            if (user.role === 'admin' && req.body.destination_id) {
                destId = req.body.destination_id;
            }
            if (!destId) {
                return res.status(400).json({ success: false, message: 'Bạn không có quyền quản lý địa điểm nào.' });
            }

            const { title, description, type, price, duration, max_participants, image, start_date, end_date } = req.body;
            if (!title) {
                return res.status(400).json({ success: false, message: 'Tên workshop là bắt buộc.' });
            }

            await UserSession.db.query(
                `INSERT INTO workshops (id, destination_id, title, description, type, price, max_participants, duration, image, start_date, end_date, is_active, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
                [uuidv4(), destId, title, description || '', type || 'other', price || 0, max_participants || 20, duration || '2 giờ', image || '/images/placeholder.jpg', start_date || null, end_date || null]
            );

            res.json({ success: true, message: 'Đã tạo workshop thành công!' });
        } catch (error) {
            console.error("Manager create workshop error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async updateWorkshop(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user.managed_destination_id;
            
            const { id, title, description, type, price, duration, max_participants, image, start_date, end_date, is_active } = req.body;
            if (!id) {
                return res.status(400).json({ success: false, message: 'Thiếu mã workshop.' });
            }

            // Verify manager owns this workshop
            const [check] = await UserSession.db.query(
                "SELECT destination_id FROM workshops WHERE id = ?",
                [id]
            );

            if (check.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy workshop.' });
            }

            if (user.role !== 'admin' && check[0].destination_id !== destId) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền chỉnh sửa workshop này.' });
            }

            await UserSession.db.query(
                `UPDATE workshops 
                 SET title = ?, description = ?, type = ?, price = ?, duration = ?, max_participants = ?, image = ?, start_date = ?, end_date = ?, is_active = ? 
                 WHERE id = ?`,
                [title, description, type, price, duration, max_participants, image, start_date || null, end_date || null, is_active !== undefined ? is_active : 1, id]
            );

            res.json({ success: true, message: 'Cập nhật workshop thành công!' });
        } catch (error) {
            console.error("Manager update workshop error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async deleteWorkshop(req, res) {
        try {
            const user = req.session.user || req.user;
            let destId = user.managed_destination_id;
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ success: false, message: 'Thiếu mã workshop.' });
            }

            // Verify ownership
            const [check] = await UserSession.db.query(
                "SELECT destination_id FROM workshops WHERE id = ?",
                [id]
            );

            if (check.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy workshop.' });
            }

            if (user.role !== 'admin' && check[0].destination_id !== destId) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa workshop này.' });
            }

            await UserSession.db.query("DELETE FROM workshops WHERE id = ?", [id]);
            res.json({ success: true, message: 'Đã xóa workshop.' });
        } catch (error) {
            console.error("Manager delete workshop error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ManagerController();
