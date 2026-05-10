/**
 * Notification Controller - Chương 5.14: Hệ thống Thông báo
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

const NotificationController = {

    // GET /api/notifications — Lấy thông báo
    getAll: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.json({ success: false, notifications: [] });

            const [notifications] = await db.query(
                'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
                [user.id]
            );
            const [unreadCount] = await db.query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
                [user.id]
            );

            res.json({ success: true, notifications, unreadCount: unreadCount[0].count });
        } catch (error) {
            res.json({ success: false, notifications: [], unreadCount: 0 });
        }
    },

    // POST /api/notifications/read — Đánh dấu đã đọc
    markRead: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.json({ success: false });

            if (req.body.id) {
                await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.body.id, user.id]);
            } else {
                await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [user.id]);
            }
            res.json({ success: true });
        } catch (error) {
            res.json({ success: false });
        }
    },

    // Helper: Tạo thông báo (dùng nội bộ bởi các module khác)
    create: async (userId, type, title, message, link = null) => {
        try {
            await db.query(
                'INSERT INTO notifications (id, user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?, ?)',
                [uuidv4(), userId, type, title, message, link]
            );
        } catch (e) {
            console.error('Notification create error:', e.message);
        }
    }
};

module.exports = NotificationController;
