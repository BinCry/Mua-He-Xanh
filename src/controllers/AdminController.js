/**
 * Admin Controller - Cấp Xã (Quản trị viên hệ thống)
 * Dashboard với biểu đồ thực tế, quản lý users, destinations, settings, reviews, events
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { uploadToCloudinary } = require('../config/cloudinary');

const AdminController = {


    // ==================== DASHBOARD ====================
    dashboard: async (req, res) => {
        try {
            const [userCount] = await db.query('SELECT COUNT(*) as total FROM users');
            const [destCount] = await db.query('SELECT COUNT(*) as total FROM destinations WHERE is_active = TRUE');
            const [checkinCount] = await db.query('SELECT COUNT(*) as total FROM check_ins');
            const [reviewCount] = await db.query('SELECT COUNT(*) as total FROM reviews');
            const [workshopCount] = await db.query('SELECT COUNT(*) as total FROM workshops WHERE is_active = TRUE');
            const [pointsSum] = await db.query('SELECT SUM(total_points) as total FROM users');
            const [eventCount] = await db.query('SELECT COUNT(*) as total FROM events WHERE is_active = TRUE');

            // Average session duration (from analytics duration_ms)
            const [avgDurationRow] = await db.query(
                "SELECT COALESCE(AVG(duration_ms), 0) as avg_duration FROM analytics WHERE duration_ms > 0"
            );
            const avgDurationSec = Math.round((avgDurationRow[0]?.avg_duration || 0) / 1000);

            // Ratings distribution (1-5 stars)
            const [ratingDistRows] = await db.query(`
                SELECT rating, COUNT(*) as count 
                FROM reviews 
                WHERE rating IS NOT NULL AND rating >= 1 AND rating <= 5 
                GROUP BY rating 
                ORDER BY rating ASC
            `);
            const ratingsMap = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            ratingDistRows.forEach(r => { ratingsMap[r.rating] = r.count; });
            const ratingsDistribution = [ratingsMap[1], ratingsMap[2], ratingsMap[3], ratingsMap[4], ratingsMap[5]];

            // Monthly check-in trend (last 6 months)
            const [checkinRows] = await db.query(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                FROM check_ins WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY month ORDER BY month ASC
            `);
            const checkinMap = {};
            checkinRows.forEach(r => { checkinMap[r.month] = r.count; });

            const monthlyCheckins = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const monthStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                monthlyCheckins.push({
                    month: monthStr,
                    count: checkinMap[monthStr] || 0
                });
            }

            // Monthly Workshop Bookings trend (last 6 months)
            const [workshopBookingRows] = await db.query(`
                SELECT DATE_FORMAT(booking_date, '%Y-%m') as month, COUNT(*) as count
                FROM workshop_bookings
                WHERE booking_date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) AND status != 'cancelled'
                GROUP BY month ORDER BY month ASC
            `);
            const wsBookingMap = {};
            workshopBookingRows.forEach(r => { wsBookingMap[r.month] = r.count; });

            const monthlyWSBookings = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                const monthStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
                monthlyWSBookings.push({
                    month: monthStr,
                    count: wsBookingMap[monthStr] || 0
                });
            }

            // Daily Check-ins (last 14 days)
            const [dailyCheckinRows] = await db.query(`
                SELECT DATE(created_at) as day, COUNT(*) as count
                FROM check_ins WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
                GROUP BY day ORDER BY day ASC
            `);
            const checkinsMap = {};
            dailyCheckinRows.forEach(r => {
                try {
                    const dateStr = new Date(r.day).toISOString().split('T')[0];
                    checkinsMap[dateStr] = r.count;
                } catch (e) {}
            });

            const dailyCheckins = [];
            for (let i = 13; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayStr = d.toISOString().split('T')[0];
                dailyCheckins.push({
                    day: dayStr,
                    count: checkinsMap[dayStr] || 0
                });
            }

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
                    totalPoints: pointsSum[0].total || 0,
                    events: eventCount[0].total,
                    avgDuration: avgDurationSec
                },
                chartData: { monthlyCheckins, dailyCheckins, monthlyUsers, ratingsDistribution, monthlyWSBookings },
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
                    (SELECT COUNT(*) FROM analytics a WHERE a.page_url COLLATE utf8mb4_unicode_ci LIKE CONCAT('/explore/', d.slug)) as page_views
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
                SELECT r.id, r.content, r.rating, r.images, r.location_name, r.created_at, r.likes_count,
                       u.full_name, u.avatar,
                       d.name as destination_name
                FROM (
                    SELECT r.id
                    FROM reviews r
                    WHERE 1=1 ${whereClause}
                    ORDER BY r.created_at DESC LIMIT 50
                ) sub
                JOIN reviews r ON sub.id = r.id
                JOIN users u ON r.user_id = u.id
                LEFT JOIN destinations d ON r.destination_id = d.id
                ORDER BY r.created_at DESC
            `, params);
            
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = TRUE ORDER BY name');
            const [soundscapes] = await db.query('SELECT * FROM soundscapes ORDER BY created_at DESC');
            
            res.render('admin/reviews', {
                title: 'Quản lý Cộng đồng',
                layout: 'layouts/admin',
                adminPage: 'reviews',
                reviews,
                destinations,
                currentDestination: destFilter,
                soundscapes
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
            const { id, role, is_active, managed_destination_id, full_name, phone, email, password } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID' });

            let query = 'UPDATE users SET role = ?, is_active = ?, managed_destination_id = ?';
            let params = [role || 'user', is_active !== undefined ? is_active : 1, managed_destination_id || null];

            if (full_name) { query += ', full_name = ?'; params.push(full_name); }
            if (phone) { query += ', phone = ?'; params.push(phone); }
            if (email) { query += ', email = ?'; params.push(email); }
            if (password && password.trim() !== '') {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                query += ', password = ?';
                params.push(hashedPassword);
            }

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

    // ==================== API: Resolve Google Maps Shortened Link ====================
    resolveMapsLink: async (req, res) => {
        try {
            const { url } = req.body;
            if (!url) return res.status(400).json({ success: false, message: 'Thiếu URL' });
            
            const axios = require('axios');
            const response = await axios.get(url, {
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });
            const finalUrl = response.request?.res?.responseUrl || response.config?.url || url;
            res.json({ success: true, finalUrl });
        } catch (error) {
            console.error('Resolve maps link error:', error);
            res.status(500).json({ success: false, message: 'Không thể giải mã link Google Maps: ' + error.message });
        }
    },

    // ==================== API: Create Destination ====================
    createDestination: async (req, res) => {
        try {
            const { name, slug, type, short_desc, points, description, open_hours, cost, lat, lng, manager_name, manager_email, manager_password } = req.body;
            if (!name || !slug) return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
            
            if (!manager_email || !manager_password) {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin tài khoản quản lý địa điểm' });
            }

            // Check duplicate email
            const [existingEmail] = await db.query('SELECT id FROM users WHERE email = ?', [manager_email]);
            if (existingEmail.length > 0) {
                return res.status(400).json({ success: false, message: 'Email quản lý đã tồn tại trên hệ thống' });
            }

            const destinationId = uuidv4();
            const parsedPoints = parseInt(points) || 10;
            const parsedLat = (lat && String(lat).trim() !== '') ? parseFloat(lat) : 10.75;
            const parsedLng = (lng && String(lng).trim() !== '') ? parseFloat(lng) : 106.54;

            // Insert Destination - all NOT NULL columns explicitly provided
            await db.query(
                `INSERT INTO destinations 
                 (id, name, slug, type, short_desc, description, open_hours, cost, lat, lng, points,
                  is_active, cover_image, sort_order, moods, seasons, story, highlight,
                  checkin_tip, qr_secret, best_time, map_x, map_y, radius_meter) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '/images/placeholder.jpg', 99,
                         ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [destinationId, name, slug, type || 'nature',
                 short_desc || '', description || '', open_hours || '08:00 - 17:00', cost || 'Miễn phí',
                 parsedLat, parsedLng, parsedPoints,
                 '[]', '[]', description || '', short_desc || '',
                 'Hãy chụp ảnh tại điểm này!', 'SECURE_' + slug.toUpperCase(),
                 'Quanh năm', 50, 50, 100]
            );

            // Create Manager User
            const managerId = uuidv4();
            const salt = await bcrypt.genSalt(10);
            const hashedManagerPassword = await bcrypt.hash(manager_password, salt);

            await db.query(
                `INSERT INTO users (id, full_name, email, password, role, role_id, managed_destination_id, avatar, total_points, is_active) 
                 VALUES (?, ?, ?, ?, 'manager', 2, ?, '/images/placeholder.jpg', 0, 1)`,
                [managerId, manager_name || `QL ${name}`, manager_email, hashedManagerPassword, destinationId]
            );
            
            res.json({ success: true, message: 'Đã tạo địa điểm và tài khoản quản lý mới thành công!' });
        } catch (error) {
            console.error('Create destination error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    },

    updateDestination: async (req, res) => {
        try {
            const { id, name, slug, short_desc, description, type, open_hours, cost, points, lat, lng, cover_image } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID' });

            const parsedPoints = parseInt(points) || 10;
            const parsedLat = (lat && String(lat).trim() !== '') ? parseFloat(lat) : null;
            const parsedLng = (lng && String(lng).trim() !== '') ? parseFloat(lng) : null;

            let query = 'UPDATE destinations SET name = ?, slug = ?, short_desc = ?, description = ?, type = ?, open_hours = ?, cost = ?, points = ?, lat = ?, lng = ?';
            let params = [name, slug, short_desc || '', description || '', type || 'nature', open_hours || '', cost || '', parsedPoints, parsedLat, parsedLng];

            if (cover_image && cover_image.trim() !== '') {
                query += ', cover_image = ?';
                params.push(cover_image);
            }

            query += ' WHERE id = ?';
            params.push(id);

            await db.query(query, params);

            if (cover_image && cover_image.trim() !== '') {
                await db.query(
                    "UPDATE users SET avatar = ? WHERE role = 'manager' AND managed_destination_id = ?",
                    [cover_image, id]
                );
            }

            res.json({ success: true, message: 'Đã cập nhật địa điểm thành công!' });
        } catch (error) {
            console.error('Update destination error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    },

    // ==================== API: Delete Destination ====================
    deleteDestination: async (req, res) => {
        try {
            const { id } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID địa điểm' });

            // 1. Delete associated manager users
            await db.query('DELETE FROM users WHERE managed_destination_id = ?', [id]);

            // 2. Delete associated workshops
            await db.query('DELETE FROM workshops WHERE destination_id = ?', [id]);

            // 3. Delete associated reviews
            await db.query('DELETE FROM reviews WHERE destination_id = ?', [id]);

            // 4. Delete associated destination likes
            await db.query('DELETE FROM destination_likes WHERE destination_id = ?', [id]);

            // 5. Delete associated user favorites
            await db.query('DELETE FROM user_favorites WHERE destination_id = ?', [id]);

            // 6. Delete the destination itself
            await db.query('DELETE FROM destinations WHERE id = ?', [id]);

            res.json({ success: true, message: 'Đã xóa địa điểm và tất cả các tài khoản/dữ liệu liên quan thành công!' });
        } catch (error) {
            console.error('Delete destination error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    },

    // ==================== API: Workshop CRUD ====================
    createWorkshop: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (user && user.role === 'admin') {
                return res.status(403).json({ success: false, message: 'Chỉ Quản lý địa điểm mới được tạo Workshop.' });
            }
            const { title, description, type, price, duration, max_participants, destination_id, image, start_date, end_date } = req.body;
            await db.query(
                `INSERT INTO workshops (id, destination_id, title, description, type, price, max_participants, duration, image, start_date, end_date, is_active, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
                [uuidv4(), destination_id || null, title, description || '', type || 'other', price || 0, max_participants || 20, duration || '2 giờ', image || '/images/placeholder.jpg', start_date || null, end_date || null]
            );
            res.json({ success: true, message: 'Đã tạo workshop!' });
        } catch (error) {
            console.error('Create workshop error:', error);
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    updateWorkshop: async (req, res) => {
        try {
            const { id, title, description, type, price, duration, max_participants, image, start_date, end_date, is_active, destination_id } = req.body;
            await db.query(
                `UPDATE workshops SET title = ?, description = ?, type = ?, price = ?, duration = ?, max_participants = ?, image = ?, start_date = ?, end_date = ?, is_active = ?, destination_id = ? WHERE id = ?`,
                [title, description, type, price, duration, max_participants, image, start_date || null, end_date || null, is_active !== undefined ? is_active : 1, destination_id || null, id]
            );
            res.json({ success: true, message: 'Đã cập nhật workshop!' });
        } catch (error) {
            console.error('Update workshop error:', error);
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

    createEvent: async (req, res) => {
        try {
            const { title, description, season, event_date, end_date, location, image, is_featured, is_countdown } = req.body;
            if (is_countdown) {
                await db.query('UPDATE events SET is_countdown = 0');
            }
            await db.query(
                `INSERT INTO events (id, title, description, season, event_date, end_date, location, image, is_featured, is_countdown, is_active) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [uuidv4(), title, description, season || 'all', event_date, end_date || null, location, image, is_featured ? 1 : 0, is_countdown ? 1 : 0]
            );
            res.json({ success: true, message: 'Đã tạo sự kiện!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    updateEvent: async (req, res) => {
        try {
            const { id, title, description, season, event_date, end_date, location, image, is_featured, is_countdown, is_active } = req.body;
            if (is_countdown) {
                await db.query('UPDATE events SET is_countdown = 0');
            }
            await db.query(
                `UPDATE events SET title = ?, description = ?, season = ?, event_date = ?, end_date = ?, location = ?, image = ?, is_featured = ?, is_countdown = ?, is_active = ? WHERE id = ?`,
                [title, description, season, event_date, end_date, location, image, is_featured ? 1 : 0, is_countdown ? 1 : 0, is_active ? 1 : 0, id]
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
    },

    journeyTemplates: async (req, res) => {
        try {
            const [templates] = await db.query('SELECT * FROM seasonal_journey_templates ORDER BY created_at DESC');
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = TRUE ORDER BY name ASC');
            res.render('admin/journey_templates', {
                title: 'Quản lý Hành trình Mẫu - Admin Panel',
                layout: 'layouts/admin',
                templates,
                destinations,
                adminPage: 'journey-templates'
            });
        } catch (error) {
            res.status(500).send('Lỗi: ' + error.message);
        }
    },

    createJourneyTemplate: async (req, res) => {
        try {
            const { name, description, season, interest, stops, duration, km } = req.body;
            if (!name || !season || !interest || !stops) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
            }
            const stopsJson = typeof stops === 'string' ? stops : JSON.stringify(stops);

            await db.query(
                `INSERT INTO seasonal_journey_templates (id, name, description, season, interest, stops, duration, km)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [uuidv4(), name, description, season, interest, stopsJson, duration || 'full_day', km || 5.0]
            );
            res.json({ success: true, message: 'Đã tạo hành trình mẫu!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    updateJourneyTemplate: async (req, res) => {
        try {
            const { id, name, description, season, interest, stops, duration, km } = req.body;
            if (!id || !name || !season || !interest || !stops) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
            }
            const stopsJson = typeof stops === 'string' ? stops : JSON.stringify(stops);

            await db.query(
                `UPDATE seasonal_journey_templates 
                 SET name = ?, description = ?, season = ?, interest = ?, stops = ?, duration = ?, km = ? 
                 WHERE id = ?`,
                [name, description, season, interest, stopsJson, duration, km, id]
            );
            res.json({ success: true, message: 'Đã cập nhật hành trình mẫu!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    deleteJourneyTemplate: async (req, res) => {
        try {
            const { id } = req.body;
            if (!id) {
                return res.status(400).json({ success: false, message: 'Thiếu ID hành trình' });
            }
            await db.query('DELETE FROM seasonal_journey_templates WHERE id = ?', [id]);
            res.json({ success: true, message: 'Đã xóa hành trình mẫu!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },
    createSoundscape: async (req, res) => {
        try {

            const { name, mood, duration_seconds } = req.body;
            if (!name || !mood) {
                return res.status(400).json({ success: false, message: 'Thiếu tên hoặc mood.' });
            }
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Thiếu file âm thanh.' });
            }

            // Upload to Cloudinary
            const result = await uploadToCloudinary(req.file.path, 'binh-loi/soundscapes');
            const audioUrl = result.url;

            await db.query(
                `INSERT INTO soundscapes (id, name, mood, audio_url, duration_seconds, is_active, created_at) 
                 VALUES (?, ?, ?, ?, ?, 1, NOW())`,
                [uuidv4(), name, mood, audioUrl, parseInt(duration_seconds) || 0]
            );

            res.json({ success: true, message: 'Đã thêm âm thanh soundscape!' });
        } catch (error) {
            console.error('Create soundscape error:', error);
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    deleteSoundscape: async (req, res) => {
        try {
            const { id } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID.' });

            await db.query('DELETE FROM soundscapes WHERE id = ?', [id]);
            res.json({ success: true, message: 'Đã xóa âm thanh!' });
        } catch (error) {
            console.error('Delete soundscape error:', error);
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    chat: async (req, res) => {

        try {
            // Conversation List for Admin (destination_id IS NULL)
            const [conversations] = await db.query(
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
                         WHERE destination_id IS NULL 
                           AND (sender_uuid = s.id OR receiver_uuid = s.id)
                         ORDER BY created_at DESC LIMIT 1
                     ) AS last_message,
                     (
                         SELECT created_at 
                         FROM messages 
                         WHERE destination_id IS NULL 
                           AND (sender_uuid = s.id OR receiver_uuid = s.id)
                         ORDER BY created_at DESC LIMIT 1
                     ) AS last_message_time
                 FROM user_sessions s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.id IN (
                     SELECT DISTINCT sender_uuid FROM messages WHERE destination_id IS NULL AND sender_uuid IS NOT NULL
                 )
                 ORDER BY last_message_time DESC`
            );

            res.render('admin/chat', {
                title: 'Hộp thư Hỗ trợ Admin',
                conversations,
                layout: 'layouts/admin',
                adminPage: 'chat'
            });
        } catch (error) {
            console.error("Admin chat page error:", error);
            res.status(500).send("Internal Server Error: " + error.message);
        }
    },

    getChatHistory: async (req, res) => {
        try {
            const { sessionId } = req.query;
            if (!sessionId) {
                return res.status(400).json({ success: false, message: 'Thiếu Session ID' });
            }

            // Fetch chat history for this session with Admin (destination_id IS NULL)
            const [messages] = await db.query(
                `SELECT * FROM messages 
                 WHERE destination_id IS NULL 
                   AND (sender_uuid = ? OR receiver_uuid = ? OR sender_id = ? OR receiver_id = ?)
                 ORDER BY created_at ASC`,
                [sessionId, sessionId, sessionId, sessionId]
            );

            // Fetch visitor details
            const [visitorDetails] = await db.query(
                `SELECT s.id, s.uuid, s.total_points, u.full_name, u.avatar, u.email, u.phone
                 FROM user_sessions s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.id = ?`,
                [sessionId]
            );

            res.json({
                success: true,
                messages,
                visitor: visitorDetails[0] || null
            });
        } catch (error) {
            console.error("Fetch admin chat history error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
};

module.exports = AdminController;
