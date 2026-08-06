/**
 * Notification Controller - Pure PostgreSQL
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

const NotificationController = {

    // GET /api/notifications - Lấy thông báo
    getAll: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.json({ success: false, notifications: [] });

            const [notifications] = await db.query(
                'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
                [user.id]
            );
            const [unreadCount] = await db.query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = 0',
                [user.id]
            );

            res.json({ success: true, notifications, unreadCount: parseInt(unreadCount[0]?.count || 0, 10) });
        } catch (error) {
            res.json({ success: false, notifications: [], unreadCount: 0 });
        }
    },

    // POST /api/notifications/read - Đánh dấu đã đọc
    markRead: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.json({ success: false });

            if (req.body.id) {
                await db.query('UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2', [req.body.id, user.id]);
            } else {
                await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = $1', [user.id]);
            }
            res.json({ success: true });
        } catch (error) {
            res.json({ success: false });
        }
    },

    // Helper: Tạo thông báo
    create: async (userId, type, title, message, link = null) => {
        try {
            await db.query(
                'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5, $6)',
                [uuidv4(), userId, type, title, message, link]
            );
        } catch (e) {
            console.error('Notification create error:', e.message);
        }
    }
};

module.exports = NotificationController;
