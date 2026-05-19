/**
 * Admin Controller — Cấp Xã (Quản trị viên hệ thống)
 * Dashboard với biểu đồ thực tế, quản lý users, destinations, settings, reviews, events
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const AdminController = {

    // ==================== DASHBOARD ====================
    dashboard: async (req, res) => {
        try {
            const [userCount] = await db.query('SELECT COUNT(*) as total FROM users');
            const [destCount] = await db.query('SELECT COUNT(*) as total FROM destinations WHERE is_active = TRUE');
            const [checkinCount] = await db.query('SELECT COUNT(*) as total FROM check_ins');
            const [reviewCount] = await db.query('SELECT COUNT(*) as total FROM reviews');
            const [workshopCount] = await db.query('SELECT COUNT(*) as total FROM workshops WHERE is_active = TRUE');

            // Real page views
            const [pageViews] = await db.query("SELECT COUNT(*) as total FROM analytics WHERE event = 'page_view'");
            const [uniqueVisitors] = await db.query("SELECT COUNT(DISTINCT session_id) as total FROM analytics WHERE event = 'page_view'");
            
            // Average session duration
            const [avgDuration] = await db.query(`
                SELECT AVG(duration_ms) as avg_ms FROM analytics 
                WHERE event = 'page_view' AND duration_ms > 0 AND duration_ms < 300000
            `);

            // Monthly check-in trend (last 6 months)
            const [monthlyCheckins] = await db.query(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                FROM check_ins WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY month ORDER BY month ASC
            `);

            // Daily page views (last 14 days)
            const [dailyViews] = await db.query(`
                SELECT DATE(created_at) as day, COUNT(*) as count
                FROM analytics WHERE event = 'page_view' AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                GROUP BY day ORDER BY day ASC
            `);

            // New users per month
            const [monthlyUsers] = await db.query(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY month ORDER BY month ASC
            `);

            // Top destinations by check-ins
            const [topDests] = await db.query(`
                SELECT d.name, d.slug, COUNT(ci.id) as checkin_count
                FROM destinations d LEFT JOIN check_ins ci ON d.id = ci.destination_id
                WHERE d.is_active = TRUE GROUP BY d.id
                ORDER BY checkin_count DESC LIMIT 5
            `);

            // Recent users
            const [recentUsers] = await db.query(`
                SELECT id, full_name, email, phone, avatar, role, total_points, created_at
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
                    pageViews: pageViews[0].total,
                    uniqueVisitors: uniqueVisitors[0].total,
                    avgDuration: Math.round((avgDuration[0]?.avg_ms || 0) / 1000)
                },
                chartData: { monthlyCheckins, dailyViews, monthlyUsers },
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
                query = `SELECT * FROM users WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ? ORDER BY created_at DESC LIMIT ? OFFSET ?`;
                countQuery = `SELECT COUNT(*) as total FROM users WHERE full_name LIKE ? OR email LIKE ? OR phone LIKE ?`;
                params = [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset];
            } else {
                query = `SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?`;
                countQuery = `SELECT COUNT(*) as total FROM users`;
                params = [limit, offset];
            }

            const [users] = await db.query(query, params);
            const [countResult] = await db.query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);
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
                    (SELECT COUNT(*) FROM analytics a WHERE a.page_url LIKE CONCAT('/explore/', d.slug)) as page_views
                FROM destinations d ORDER BY d.sort_order ASC
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
                SELECT w.*, d.name as destination_name
                FROM workshops w LEFT JOIN destinations d ON w.destination_id = d.id
                ORDER BY w.created_at DESC
            `);
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = TRUE');
            res.render('admin/workshops', {
                title: 'Quản lý Workshop',
                layout: 'layouts/admin',
                adminPage: 'workshops',
                workshops,
                destinations
            });
        } catch (error) {
            console.error('Admin workshops error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // ==================== REVIEWS ====================
    reviews: async (req, res) => {
        try {
            const destFilter = req.query.destination || '';
            let whereClause = '';
            let params = [];
            if (destFilter) {
                whereClause = 'AND r.destination_id = ?';
                params = [destFilter];
            }

            const [reviews] = await db.query(`
                SELECT r.*, u.full_name, u.avatar, d.name as destination_name
                FROM reviews r JOIN users u ON r.user_id = u.id
                LEFT JOIN destinations d ON r.destination_id = d.id
                WHERE 1=1 ${whereClause}
                ORDER BY r.created_at DESC LIMIT 50
            `, params);
            
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = TRUE ORDER BY name');
            
            res.render('admin/reviews', {
                title: 'Duyệt Đánh Giá',
                layout: 'layouts/admin',
                adminPage: 'reviews',
                reviews,
                destinations,
                currentDestination: destFilter
            });
        } catch (error) {
            console.error('Admin reviews error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // ==================== EVENTS ====================
    events: async (req, res) => {
        try {
            const [events] = await db.query('SELECT * FROM events ORDER BY event_date ASC');
            res.render('admin/events', {
                title: 'Quản lý Sự kiện',
                layout: 'layouts/admin',
                adminPage: 'events',
                events
            });
        } catch (error) {
            console.error('Admin events error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // ==================== API: Create User ====================
    createUser: async (req, res) => {
        try {
            const { full_name, phone, email, password, role } = req.body;
            if (!full_name || !password) return res.status(400).json({ success: false, message: 'Thiếu thông tin' });

            // Check duplicate phone
            if (phone) {
                const [existing] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
                if (existing.length > 0) return res.json({ success: false, message: 'Số điện thoại đã tồn tại' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const id = uuidv4();

            await db.query(
                'INSERT INTO users (id, full_name, email, phone, password, role, is_active, total_points) VALUES (?, ?, ?, ?, ?, ?, 1, 0)',
                [id, full_name, email || (phone + '@phone.local'), phone, hashedPassword, role || 'user']
            );

            res.json({ success: true, message: 'Đã tạo tài khoản!' });
        } catch (error) {
            console.error('Create user error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // ==================== API: Update User ====================
    updateUser: async (req, res) => {
        try {
            const { id, role, is_active, managed_destination_id, full_name, phone, email } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID' });

            let query = 'UPDATE users SET role = ?, is_active = ?, managed_destination_id = ?';
            let params = [role || 'user', is_active !== undefined ? is_active : 1, managed_destination_id || null];

            if (full_name) { query += ', full_name = ?'; params.push(full_name); }
            if (phone) { query += ', phone = ?'; params.push(phone); }
            if (email) { query += ', email = ?'; params.push(email); }

            query += ' WHERE id = ?';
            params.push(id);

            await db.query(query, params);
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
    },

    // ==================== API: Create Destination ====================
    createDestination: async (req, res) => {
        try {
            const { name, slug, type, short_desc, points, description, open_hours, cost, lat, lng } = req.body;
            if (!name || !slug) return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });

            const [result] = await db.query(
                `INSERT INTO destinations (id, name, slug, type, short_desc, description, open_hours, cost, lat, lng, points, is_active, cover_image, sort_order) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '/images/placeholder.jpg', 99)`,
                [uuidv4(), name, slug, type || 'nature', short_desc || '', description || '', open_hours || '', cost || '', lat || null, lng || null, points || 10]
            );
            
            res.json({ success: true, message: 'Đã tạo địa điểm mới!' });
        } catch (error) {
            console.error('Create destination error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    },

    // ==================== API: Update Destination ====================
    updateDestination: async (req, res) => {
        try {
            const { id, name, short_desc, description, type, open_hours, cost, points, lat, lng, cover_image } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID' });

            let query = 'UPDATE destinations SET name = ?, short_desc = ?, description = ?, type = ?, open_hours = ?, cost = ?, points = ?';
            let params = [name, short_desc, description, type, open_hours, cost, points];

            if (lat) { query += ', lat = ?'; params.push(lat); }
            if (lng) { query += ', lng = ?'; params.push(lng); }
            if (cover_image) { query += ', cover_image = ?'; params.push(cover_image); }

            query += ' WHERE id = ?';
            params.push(id);

            await db.query(query, params);
            res.json({ success: true, message: 'Đã cập nhật địa điểm!' });
        } catch (error) {
            console.error('Update destination error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // ==================== API: Delete Destination ====================
    deleteDestination: async (req, res) => {
        try {
            const { id } = req.body;
            await db.query('DELETE FROM destinations WHERE id = ?', [id]);
            res.json({ success: true, message: 'Đã xóa địa điểm' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // ==================== API: Workshop CRUD ====================
    createWorkshop: async (req, res) => {
        try {
            const { title, description, type, price, duration, max_participants, destination_id, image } = req.body;
            await db.query(
                `INSERT INTO workshops (id, title, description, type, price, duration, max_participants, destination_id, image, is_active, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
                [uuidv4(), title, description, type || 'craft', price || 0, duration || '2 giờ', max_participants || 20, destination_id || null, image || '/images/placeholder.jpg']
            );
            res.json({ success: true, message: 'Đã tạo workshop!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    updateWorkshop: async (req, res) => {
        try {
            const { id, title, description, type, price, duration, max_participants, image, is_active } = req.body;
            await db.query(
                `UPDATE workshops SET title = ?, description = ?, type = ?, price = ?, duration = ?, max_participants = ?, image = ?, is_active = ? WHERE id = ?`,
                [title, description, type, price, duration, max_participants, image, is_active !== undefined ? is_active : 1, id]
            );
            res.json({ success: true, message: 'Đã cập nhật workshop!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    deleteWorkshop: async (req, res) => {
        try {
            await db.query('DELETE FROM workshops WHERE id = ?', [req.body.id]);
            res.json({ success: true, message: 'Đã xóa workshop' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // ==================== API: Delete Review ====================
    deleteReview: async (req, res) => {
        try {
            await db.query('DELETE FROM reviews WHERE id = ?', [req.body.id]);
            res.json({ success: true, message: 'Đã xóa bài đăng' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // ==================== API: Events CRUD ====================
    createEvent: async (req, res) => {
        try {
            const { title, description, season, event_date, end_date, location, image, is_featured } = req.body;
            await db.query(
                `INSERT INTO events (id, title, description, season, event_date, end_date, location, image, is_featured, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [uuidv4(), title, description, season || 'all', event_date, end_date || null, location, image, is_featured ? 1 : 0]
            );
            res.json({ success: true, message: 'Đã tạo sự kiện!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    updateEvent: async (req, res) => {
        try {
            const { id, title, description, season, event_date, end_date, location, image, is_featured, is_active } = req.body;
            await db.query(
                `UPDATE events SET title = ?, description = ?, season = ?, event_date = ?, end_date = ?, location = ?, image = ?, is_featured = ?, is_active = ? WHERE id = ?`,
                [title, description, season, event_date, end_date, location, image, is_featured ? 1 : 0, is_active ? 1 : 0, id]
            );
            res.json({ success: true, message: 'Đã cập nhật sự kiện!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    deleteEvent: async (req, res) => {
        try {
            await db.query('DELETE FROM events WHERE id = ?', [req.body.id]);
            res.json({ success: true, message: 'Đã xóa sự kiện' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    }
};

module.exports = AdminController;
