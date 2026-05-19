const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');

class ManagerController {
    async index(req, res) {
        try {
            const user = req.session.user;
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

            // 4. Page Views (Lượt truy cập)
            const [pageViewsStats] = await UserSession.db.query(
                "SELECT COUNT(*) as total FROM analytics WHERE page_url LIKE ? OR page_url LIKE ?",
                [`%/explore/${dest.slug}%`, `%/explore/${dest.id}%`]
            );

            // 5. Doanh thu (Revenue)
            const [revenueStats] = await UserSession.db.query(
                `SELECT COALESCE(SUM(wb.total_price), 0) as total
                 FROM workshop_bookings wb
                 JOIN workshops w ON wb.workshop_id = w.id
                 WHERE w.destination_id = ?`,
                [dest.id]
            );

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
                `SELECT r.*, u.full_name, u.avatar 
                 FROM reviews r
                 LEFT JOIN users u ON r.user_id = u.id
                 WHERE r.destination_id = ?
                 ORDER BY r.created_at DESC LIMIT 3`,
                [dest.id]
            );

            // 3. Conversation List (Facebook Fanpage style)
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

            res.render('manager/index', {
                title: 'Quản lý: ' + dest.name,
                dest,
                stats: {
                    checkins: checkinStats[0].total,
                    chats: convoStats[0].total,
                    reviewsCount: reviewStats[0].count,
                    avgRating: parseFloat(reviewStats[0].avg_rating).toFixed(1),
                    pageViews: pageViewsStats[0].total,
                    revenue: revenueStats[0].total
                },
                recentCheckins,
                recentReviews,
                conversations,
                layout: 'layouts/admin',
                adminPage: 'manager'
            });
        } catch (error) {
            console.error("Manager index error:", error);
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
            // Check if user is Admin, as Managers are now chat-only
            if (req.session.user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Chỉ Admin mới có quyền cập nhật thông tin địa điểm.' });
            }

            const user = req.session.user;
            const { dest_id, open_hours, cost, cover_image, highlight, checkin_tip, story, zen_walk_desc, best_time, short_desc } = req.body;
            
            let targetDestId = dest_id;

            if (!targetDestId) {
                return res.redirect('/manager?error=Không xác định được địa điểm cần cập nhật');
            }

            await Destination.update(targetDestId, {
                open_hours: open_hours || '',
                cost: cost || '',
                cover_image: cover_image || '',
                highlight: highlight || '',
                checkin_tip: checkin_tip || '',
                story: story || '',
                zen_walk_desc: zen_walk_desc || '',
                best_time: best_time || '',
                short_desc: short_desc || ''
            });

            // Redirect back to the specific destination if admin, or just /manager if manager
            if (user.role === 'admin') {
                res.redirect(`/manager?dest_id=${targetDestId}&success=Đã cập nhật thông tin địa điểm`);
            } else {
                res.redirect('/manager?success=Đã cập nhật thông tin địa điểm');
            }
        } catch (error) {
            console.error("Update Destination Error:", error);
            res.redirect('/manager?error=' + encodeURIComponent(error.message));
        }
    }
}

module.exports = new ManagerController();
