/**
 * Admin Controller — Cấp Xã (Quản trị viên hệ thống)
 * Dashboard với biểu đồ, quản lý users, destinations, settings, reviews
 */
const db = require('../core/database');

const AdminController = {

    // ==================== DASHBOARD ====================
    dashboard: async (req, res) => {
        try {
            const [userCount] = await db.query('SELECT COUNT(*) as total FROM users');
            const [destCount] = await db.query('SELECT COUNT(*) as total FROM destinations WHERE is_active = TRUE');
            const [checkinCount] = await db.query('SELECT COUNT(*) as total FROM check_ins');
            const [reviewCount] = await db.query('SELECT COUNT(*) as total FROM reviews');
            const [workshopCount] = await db.query('SELECT COUNT(*) as total FROM workshops WHERE is_active = TRUE');
            const [messageCount] = await db.query('SELECT COUNT(*) as total FROM messages');

            // Monthly check-in trend (last 6 months)
            const [monthlyCheckins] = await db.query(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                FROM check_ins
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY month ORDER BY month ASC
            `);

            // Daily page views (last 14 days) from analytics table
            const [dailyViews] = await db.query(`
                SELECT DATE(created_at) as day, COUNT(*) as count
                FROM analytics
                WHERE event = 'page_view' AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                GROUP BY day ORDER BY day ASC
            `);

            // New users per month (last 6 months)
            const [monthlyUsers] = await db.query(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                FROM users
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY month ORDER BY month ASC
            `);

            // Top destinations by check-ins
            const [topDests] = await db.query(`
                SELECT d.name, d.slug, COUNT(ci.id) as checkin_count
                FROM destinations d
                LEFT JOIN check_ins ci ON d.id = ci.destination_id
                WHERE d.is_active = TRUE
                GROUP BY d.id
                ORDER BY checkin_count DESC
                LIMIT 5
            `);

            // Recent users
            const [recentUsers] = await db.query(`
                SELECT id, full_name, email, avatar, role, total_points, created_at
                FROM users ORDER BY created_at DESC LIMIT 8
            `);

            res.render('admin/dashboard', {
                title: 'Bảng Điều Khiển Admin',
                layout: 'layouts/admin',
                adminPage: 'dashboard',
                stats: {
                    users: userCount[0].total,
                    destinations: destCount[0].total,
                    checkins: checkinCount[0].total,
                    reviews: reviewCount[0].total,
                    workshops: workshopCount[0].total,
                    messages: messageCount[0].total
                },
                chartData: {
                    monthlyCheckins,
                    dailyViews,
                    monthlyUsers
                },
                topDests,
                recentUsers
            });
        } catch (error) {
            console.error('Admin dashboard error:', error);
            res.status(500).send('Lỗi hệ thống: ' + error.message);
        }
    },

    // ==================== USERS ====================
    users: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 15;
            const offset = (page - 1) * limit;
            const search = req.query.q || '';

            let query, countQuery, params;
            if (search) {
                query = `SELECT * FROM users WHERE full_name LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
                countQuery = `SELECT COUNT(*) as total FROM users WHERE full_name LIKE ? OR email LIKE ?`;
                params = [`%${search}%`, `%${search}%`, limit, offset];
            } else {
                query = `SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`;
                countQuery = `SELECT COUNT(*) as total FROM users`;
                params = [limit, offset];
            }

            const [users] = await db.query(query, params);
            const [countResult] = await db.query(countQuery, search ? [`%${search}%`, `%${search}%`] : []);
            const totalPages = Math.ceil(countResult[0].total / limit);
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = TRUE ORDER BY sort_order');

            res.render('admin/users', {
                title: 'Quản lý Người dùng',
                layout: 'layouts/admin',
                adminPage: 'users',
                users, destinations,
                currentPage: page, totalPages,
                searchQuery: search
            });
        } catch (error) {
            console.error('Admin users error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // ==================== DESTINATIONS ====================
    destinations: async (req, res) => {
        try {
            const [dests] = await db.query(`
                SELECT d.*, 
                    (SELECT COUNT(*) FROM check_ins ci WHERE ci.destination_id = d.id) as checkin_count,
                    (SELECT full_name FROM users u WHERE u.managed_destination_id = d.id AND u.role = 'manager' LIMIT 1) as manager_name
                FROM destinations d
                ORDER BY d.sort_order ASC
            `);

            res.render('admin/destinations', {
                title: 'Quản lý Địa điểm',
                layout: 'layouts/admin',
                adminPage: 'destinations',
                destinations: dests
            });
        } catch (error) {
            console.error('Admin destinations error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // ==================== SITE SETTINGS ====================
    siteSettings: async (req, res) => {
        try {
            const [settings] = await db.query('SELECT * FROM settings');
            const settingsMap = {};
            settings.forEach(s => { settingsMap[s.key_name] = s.key_value; });

            res.render('admin/settings', {
                title: 'Cài đặt Trang web',
                layout: 'layouts/admin',
                adminPage: 'settings',
                settings: settingsMap
            });
        } catch (error) {
            console.error('Admin settings error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // ==================== WORKSHOPS ====================
    workshops: async (req, res) => {
        try {
            const [workshops] = await db.query(`
                SELECT w.*, d.name as destination_name,
                       (SELECT COUNT(*) FROM workshop_bookings wb WHERE wb.workshop_id = w.id) as booking_count
                FROM workshops w
                LEFT JOIN destinations d ON w.destination_id = d.id
                ORDER BY w.created_at DESC
            `);
            res.render('admin/workshops', {
                title: 'Quản lý Workshop',
                layout: 'layouts/admin',
                adminPage: 'workshops',
                workshops
            });
        } catch (error) {
            console.error('Admin workshops error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // ==================== REVIEWS ====================
    reviews: async (req, res) => {
        try {
            const [reviews] = await db.query(`
                SELECT r.*, u.full_name, u.avatar, d.name as destination_name
                FROM reviews r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN destinations d ON r.destination_id = d.id
                ORDER BY r.created_at DESC LIMIT 50
            `);
            res.render('admin/reviews', {
                title: 'Duyệt Đánh Giá',
                layout: 'layouts/admin',
                adminPage: 'reviews',
                reviews
            });
        } catch (error) {
            console.error('Admin reviews error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // ==================== API: Update User ====================
    updateUser: async (req, res) => {
        try {
            const { id, role, is_active, managed_destination_id } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID' });

            const roleMap = { 'admin': 1, 'manager': 2, 'user': 3 };

            await db.query(
                `UPDATE users SET role = ?, role_id = ?, is_active = ?, managed_destination_id = ? WHERE id = ?`,
                [role || 'user', roleMap[role] || 3, is_active !== undefined ? is_active : 1, managed_destination_id || null, id]
            );
            res.json({ success: true, message: 'Cập nhật thành công!' });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // ==================== API: Delete User ====================
    deleteUser: async (req, res) => {
        try {
            const { id } = req.body;
            const currentUser = req.user || req.session.user;
            if (id === currentUser.id) {
                return res.json({ success: false, message: 'Không thể tự xóa chính mình!' });
            }
            await db.query('DELETE FROM users WHERE id = ?', [id]);
            res.json({ success: true, message: 'Đã xóa người dùng' });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // ==================== API: Toggle Destination ====================
    toggleDestination: async (req, res) => {
        try {
            const { id, is_active } = req.body;
            await db.query('UPDATE destinations SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, id]);
            res.json({ success: true, message: is_active ? 'Đã kích hoạt' : 'Đã ẩn địa điểm' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // ==================== API: Update Settings ====================
    updateSettings: async (req, res) => {
        try {
            const entries = Object.entries(req.body);
            for (const [key, value] of entries) {
                await db.query(
                    `INSERT INTO settings (key_name, key_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE key_value = ?`,
                    [key, value, value]
                );
            }
            res.json({ success: true, message: 'Đã cập nhật cài đặt!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    }
};

module.exports = AdminController;
