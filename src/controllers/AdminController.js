/**
 * Admin Controller - Pure PostgreSQL Implementation
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
            const [destCount] = await db.query('SELECT COUNT(*) as total FROM destinations WHERE is_active = 1');
            const [checkinCount] = await db.query('SELECT COUNT(*) as total FROM check_ins');
            const [reviewCount] = await db.query('SELECT COUNT(*) as total FROM reviews');
            const [pageViewsRow] = await db.query('SELECT COUNT(*) as total FROM analytics');
            const [eventCount] = await db.query('SELECT COUNT(*) as total FROM events WHERE is_active = 1');

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
            ratingDistRows.forEach(r => { ratingsMap[r.rating] = parseInt(r.count, 10); });
            const ratingsDistribution = [ratingsMap[1], ratingsMap[2], ratingsMap[3], ratingsMap[4], ratingsMap[5]];

            // Monthly check-in trend (last 6 months - PostgreSQL TO_CHAR & INTERVAL)
            const [checkinRows] = await db.query(`
                SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
                FROM check_ins WHERE created_at >= NOW() - INTERVAL '6 month'
                GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month ASC
            `);
            const checkinMap = {};
            checkinRows.forEach(r => { checkinMap[r.month] = parseInt(r.count, 10); });

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
                SELECT TO_CHAR(booking_date, 'YYYY-MM') as month, COUNT(*) as count
                FROM workshop_bookings
                WHERE booking_date >= NOW() - INTERVAL '6 month' AND status != 'cancelled'
                GROUP BY TO_CHAR(booking_date, 'YYYY-MM') ORDER BY month ASC
            `);
            const wsBookingMap = {};
            workshopBookingRows.forEach(r => { wsBookingMap[r.month] = parseInt(r.count, 10); });

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
                FROM check_ins WHERE created_at >= NOW() - INTERVAL '14 day'
                GROUP BY DATE(created_at) ORDER BY day ASC
            `);
            const checkinsMap = {};
            dailyCheckinRows.forEach(r => {
                try {
                    const dateStr = new Date(r.day).toISOString().split('T')[0];
                    checkinsMap[dateStr] = parseInt(r.count, 10);
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
                SELECT TO_CHAR(created_at, 'YYYY-MM') as month, COUNT(*) as count
                FROM users WHERE created_at >= NOW() - INTERVAL '6 month'
                GROUP BY TO_CHAR(created_at, 'YYYY-MM') ORDER BY month ASC
            `);

            // Top destinations by check-ins
            const [topDests] = await db.query(`
                SELECT d.name, d.slug, COUNT(ci.id) as checkin_count
                FROM destinations d LEFT JOIN check_ins ci ON d.id = ci.destination_id
                WHERE d.is_active = 1 GROUP BY d.id
                ORDER BY checkin_count DESC LIMIT 5
            `);

            // Recent users
            const [recentUsers] = await db.query(`
                SELECT id, full_name, email, phone, avatar, role, total_points, created_at
                FROM users ORDER BY created_at DESC LIMIT 4
            `);

            res.render('admin/dashboard', {
                title: 'Bảng Điều Khiển Admin',
                layout: 'layouts/admin',
                adminPage: 'dashboard',
                stats: {
                    users: parseInt(userCount?.[0]?.total || 0, 10) || 0,
                    destinations: parseInt(destCount?.[0]?.total || 0, 10) || 0,
                    checkins: parseInt(checkinCount?.[0]?.total || 0, 10) || 0,
                    reviews: parseInt(reviewCount?.[0]?.total || 0, 10) || 0,
                    pageViews: parseInt(pageViewsRow?.[0]?.total || 0, 10) || 0,
                    events: parseInt(eventCount?.[0]?.total || 0, 10) || 0,
                    avgDuration: avgDurationSec || 0
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
                query = `SELECT * FROM users WHERE full_name LIKE $1 OR email LIKE $2 OR phone LIKE $3 ORDER BY created_at DESC LIMIT $4 OFFSET $5`;
                countQuery = `SELECT COUNT(*) as total FROM users WHERE full_name LIKE $1 OR email LIKE $2 OR phone LIKE $3`;
                params = [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset];
            } else {
                query = `SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2`;
                countQuery = `SELECT COUNT(*) as total FROM users`;
                params = [limit, offset];
            }

            const [users] = await db.query(query, params);
            const [countResult] = await db.query(countQuery, search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []);
            const totalPages = Math.ceil(parseInt(countResult[0]?.total || 0, 10) / limit);
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = 1 ORDER BY sort_order');

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
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = 1');
            res.render('admin/workshops', {
                layout: 'layouts/admin',
                title: 'Quản lý Shop & Sản Phẩm',
                workshops,
                destinations,
                activeMenu: 'workshops'
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
                whereClause = 'AND r.destination_id = $1';
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
            
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = 1 ORDER BY name');
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

            if (phone) {
                const [existing] = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
                if (existing.length > 0) return res.json({ success: false, message: 'Số điện thoại đã tồn tại' });
            }

            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);
            const id = uuidv4();

            await db.query(
                'INSERT INTO users (id, full_name, email, phone, password, role, is_active, total_points) VALUES ($1, $2, $3, $4, $5, $6, 1, 0)',
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

            let sets = ['role = $1', 'is_active = $2', 'managed_destination_id = $3'];
            let params = [role || 'user', is_active !== undefined ? is_active : 1, managed_destination_id || null];
            let index = 4;

            if (full_name) { sets.push(`full_name = $${index++}`); params.push(full_name); }
            if (phone) { sets.push(`phone = $${index++}`); params.push(phone); }
            if (email) { sets.push(`email = $${index++}`); params.push(email); }
            if (password && password.trim() !== '') {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(password, salt);
                sets.push(`password = $${index++}`);
                params.push(hashedPassword);
            }

            params.push(id);
            const query = `UPDATE users SET ${sets.join(', ')} WHERE id = $${index}`;

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
            await db.query('DELETE FROM users WHERE id = $1', [id]);
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
            await db.query('UPDATE destinations SET is_active = $1 WHERE id = $2', [is_active ? 1 : 0, id]);
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
                    `INSERT INTO settings (key_name, key_value) VALUES ($1, $2) ON CONFLICT (key_name) DO UPDATE SET key_value = EXCLUDED.key_value`,
                    [key, value]
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
            const { name, slug, type, short_desc, points, description, open_hours, cost, lat, lng, cover_image, banner_image, manager_name, manager_email, manager_password } = req.body;
            if (!name || !slug) return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
            
            if (!manager_email || !manager_password) {
                return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin tài khoản quản lý địa điểm' });
            }

            const [existingEmail] = await db.query('SELECT id FROM users WHERE email = $1', [manager_email]);
            if (existingEmail.length > 0) {
                return res.status(400).json({ success: false, message: 'Email quản lý đã tồn tại trên hệ thống' });
            }

            const destinationId = uuidv4();
            const parsedPoints = parseInt(points) || 10;
            const parsedLat = (lat && String(lat).trim() !== '') ? parseFloat(lat) : 10.75;
            const parsedLng = (lng && String(lng).trim() !== '') ? parseFloat(lng) : 106.54;
            const finalCover = (cover_image && cover_image.trim()) ? cover_image : '/images/placeholder.jpg';
            const finalBanner = (banner_image && banner_image.trim()) ? banner_image : finalCover;

            await db.query(
                `INSERT INTO destinations 
                 (id, name, slug, type, short_desc, description, open_hours, cost, lat, lng, points,
                  is_active, cover_image, banner_image, sort_order, moods, seasons, story, highlight,
                  checkin_tip, qr_secret, best_time, map_x, map_y, radius_meter) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1, $12, $13, 99,
                         $14, $15, $16, $17, $18, $19, $20, $21, $22, 100)`,
                [destinationId, name, slug, type || 'nature',
                 short_desc || '', description || '', open_hours || '08:00 - 17:00', cost || 'Miễn phí',
                 parsedLat, parsedLng, parsedPoints,
                 finalCover, finalBanner,
                 '[]', '[]', description || '', short_desc || '',
                 'Hãy chụp ảnh tại điểm này!', 'SECURE_' + slug.toUpperCase(),
                 'Quanh năm', 50, 50]
            );

            const managerId = uuidv4();
            const salt = await bcrypt.genSalt(10);
            const hashedManagerPassword = await bcrypt.hash(manager_password, salt);

            await db.query(
                `INSERT INTO users (id, full_name, email, password, role, role_id, managed_destination_id, avatar, total_points, is_active) 
                 VALUES ($1, $2, $3, $4, 'manager', 2, $5, $6, 0, 1)`,
                [managerId, manager_name || `QL ${name}`, manager_email, hashedManagerPassword, destinationId, finalCover]
            );
            
            res.json({ success: true, message: 'Đã tạo địa điểm và tài khoản quản lý mới thành công!' });
        } catch (error) {
            console.error('Create destination error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    },

    updateDestination: async (req, res) => {
        try {
            const { id, name, slug, short_desc, description, type, open_hours, cost, points, lat, lng, cover_image, banner_image } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID' });

            const parsedPoints = parseInt(points) || 10;
            const parsedLat = (lat && String(lat).trim() !== '') ? parseFloat(lat) : null;
            const parsedLng = (lng && String(lng).trim() !== '') ? parseFloat(lng) : null;

            let query = 'UPDATE destinations SET name = $1, slug = $2, short_desc = $3, description = $4, type = $5, open_hours = $6, cost = $7, points = $8, lat = $9, lng = $10';
            let params = [name, slug, short_desc || '', description || '', type || 'nature', open_hours || '', cost || '', parsedPoints, parsedLat, parsedLng];
            let index = 11;

            if (cover_image && cover_image.trim() !== '') {
                query += `, cover_image = $${index++}`;
                params.push(cover_image);
            }
            if (banner_image && banner_image.trim() !== '') {
                query += `, banner_image = $${index++}`;
                params.push(banner_image);
            }

            query += ` WHERE id = $${index}`;
            params.push(id);

            await db.query(query, params);

            if (cover_image && cover_image.trim() !== '') {
                await db.query(
                    "UPDATE users SET avatar = $1 WHERE role = 'manager' AND managed_destination_id = $2",
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

            await db.query('DELETE FROM users WHERE managed_destination_id = $1', [id]);
            await db.query('DELETE FROM workshops WHERE destination_id = $1', [id]);
            await db.query('DELETE FROM reviews WHERE destination_id = $1', [id]);
            await db.query('DELETE FROM destination_likes WHERE destination_id = $1', [id]);
            await db.query('DELETE FROM user_favorites WHERE destination_id = $1', [id]);
            await db.query('DELETE FROM destinations WHERE id = $1', [id]);

            res.json({ success: true, message: 'Đã xóa địa điểm và tất cả dữ liệu liên quan!' });
        } catch (error) {
            console.error('Delete destination error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    },

    // ==================== API: Shop Products CRUD ====================
    createWorkshop: async (req, res) => {
        try {
            const { title, description, type, price, duration, max_participants, destination_id, image, start_date, end_date, is_active } = req.body;
            if (!title) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập tên sản phẩm.' });
            }
            await db.query(
                `INSERT INTO workshops (id, destination_id, title, description, type, price, max_participants, duration, image, start_date, end_date, is_active, created_at) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
                [uuidv4(), destination_id || null, title, description || '', type || 'ecology', price || 0, max_participants || 100, duration || 'Hộp / Chiếc', image || '/images/hero-2.png', start_date || null, end_date || null, is_active ? 1 : 0]
            );
            res.json({ success: true, message: 'Đã tạo sản phẩm thành công!' });
        } catch (error) {
            console.error('Create product error:', error);
            res.status(500).json({ success: false, message: 'Lỗi tạo sản phẩm: ' + error.message });
        }
    },

    updateWorkshop: async (req, res) => {
        try {
            const { id, title, description, type, price, duration, max_participants, image, start_date, end_date, is_active, destination_id } = req.body;
            if (!id || !title) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin sản phẩm.' });
            }
            await db.query(
                `UPDATE workshops SET title = $1, description = $2, type = $3, price = $4, duration = $5, max_participants = $6, image = $7, start_date = $8, end_date = $9, is_active = $10, destination_id = $11 WHERE id = $12`,
                [title, description || '', type || 'ecology', price || 0, duration || 'Hộp / Chiếc', max_participants || 100, image || '/images/hero-2.png', start_date || null, end_date || null, is_active ? 1 : 0, destination_id || null, id]
            );
            res.json({ success: true, message: 'Đã cập nhật thông tin sản phẩm!' });
        } catch (error) {
            console.error('Update product error:', error);
            res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + error.message });
        }
    },

    deleteWorkshop: async (req, res) => {
        try {
            await db.query('DELETE FROM workshops WHERE id = $1', [req.body.id]);
            res.json({ success: true, message: 'Đã xóa workshop' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    deleteReview: async (req, res) => {
        try {
            await db.query('DELETE FROM reviews WHERE id = $1', [req.body.id]);
            res.json({ success: true, message: 'Đã xóa bài đăng' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    createEvent: async (req, res) => {
        try {
            const { title, description, season, event_date, end_date, location, image, banner_image, is_featured, is_countdown } = req.body;
            if (is_countdown) {
                await db.query('UPDATE events SET is_countdown = 0');
            }
            const finalImg = (image && image.trim()) ? image : '/images/hero-1.png';
            const finalBanner = (banner_image && banner_image.trim()) ? banner_image : finalImg;
            await db.query(
                `INSERT INTO events (id, title, description, season, event_date, end_date, location, image, banner_image, is_featured, is_countdown, is_active) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 1)`,
                [uuidv4(), title, description, season || 'all', event_date, end_date || null, location, finalImg, finalBanner, is_featured ? 1 : 0, is_countdown ? 1 : 0]
            );
            res.json({ success: true, message: 'Đã tạo sự kiện!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    updateEvent: async (req, res) => {
        try {
            const { id, title, description, season, event_date, end_date, location, image, banner_image, is_featured, is_countdown, is_active } = req.body;
            if (is_countdown) {
                await db.query('UPDATE events SET is_countdown = 0');
            }
            const finalImg = (image && image.trim()) ? image : '/images/hero-1.png';
            const finalBanner = (banner_image && banner_image.trim()) ? banner_image : finalImg;
            await db.query(
                `UPDATE events SET title = $1, description = $2, season = $3, event_date = $4, end_date = $5, location = $6, image = $7, banner_image = $8, is_featured = $9, is_countdown = $10, is_active = $11 WHERE id = $12`,
                [title, description, season, event_date, end_date, location, finalImg, finalBanner, is_featured ? 1 : 0, is_countdown ? 1 : 0, is_active ? 1 : 0, id]
            );
            res.json({ success: true, message: 'Đã cập nhật sự kiện!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    deleteEvent: async (req, res) => {
        try {
            await db.query('DELETE FROM events WHERE id = $1', [req.body.id]);
            res.json({ success: true, message: 'Đã xóa sự kiện' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    journeyTemplates: async (req, res) => {
        try {
            const [templates] = await db.query('SELECT * FROM seasonal_journey_templates ORDER BY created_at DESC');
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = 1 ORDER BY name ASC');
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
            const { name, description, season, interest, stops, duration, km, valid_from, valid_until } = req.body;
            if (!name || !season || !interest || !stops) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
            }
            const stopsJson = typeof stops === 'string' ? stops : JSON.stringify(stops);
            const vFrom = valid_from ? valid_from : null;
            const vUntil = valid_until ? valid_until : null;

            await db.query(
                `INSERT INTO seasonal_journey_templates (id, name, description, season, interest, stops, duration, km, valid_from, valid_until)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [uuidv4(), name, description, season, interest, stopsJson, duration || 'full_day', km || 5.0, vFrom, vUntil]
            );
            res.json({ success: true, message: 'Đã tạo hành trình mẫu!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    updateJourneyTemplate: async (req, res) => {
        try {
            const { id, name, description, season, interest, stops, duration, km, valid_from, valid_until } = req.body;
            if (!id || !name || !season || !interest || !stops) {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
            }
            const stopsJson = typeof stops === 'string' ? stops : JSON.stringify(stops);
            const vFrom = valid_from ? valid_from : null;
            const vUntil = valid_until ? valid_until : null;

            await db.query(
                `UPDATE seasonal_journey_templates 
                 SET name = $1, description = $2, season = $3, interest = $4, stops = $5, duration = $6, km = $7, valid_from = $8, valid_until = $9 
                 WHERE id = $10`,
                [name, description, season, interest, stopsJson, duration, km, vFrom, vUntil, id]
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
            await db.query('DELETE FROM seasonal_journey_templates WHERE id = $1', [id]);
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

            const result = await uploadToCloudinary(req.file.path, 'binh-loi/soundscapes');
            const audioUrl = result.url;

            await db.query(
                `INSERT INTO soundscapes (id, name, mood, audio_url, duration_seconds, is_active, created_at) 
                 VALUES ($1, $2, $3, $4, $5, 1, NOW())`,
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

            await db.query('DELETE FROM soundscapes WHERE id = $1', [id]);
            res.json({ success: true, message: 'Đã xóa âm thanh!' });
        } catch (error) {
            console.error('Delete soundscape error:', error);
            res.status(500).json({ success: false, message: 'Lỗi: ' + error.message });
        }
    },

    chat: async (req, res) => {
        try {
            let conversations = [];
            try {
                const [rows] = await db.query(
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
                             WHERE (sender_uuid = s.id OR receiver_uuid = s.id)
                             ORDER BY created_at DESC LIMIT 1
                         ) AS last_message,
                         (
                             SELECT created_at 
                             FROM messages 
                             WHERE (sender_uuid = s.id OR receiver_uuid = s.id)
                             ORDER BY created_at DESC LIMIT 1
                         ) AS last_message_time
                     FROM user_sessions s
                     LEFT JOIN users u ON s.user_id = u.id
                     WHERE s.id IN (
                         SELECT DISTINCT sender_uuid FROM messages WHERE sender_uuid IS NOT NULL
                         UNION
                         SELECT DISTINCT receiver_uuid FROM messages WHERE receiver_uuid IS NOT NULL
                     )
                     ORDER BY last_message_time DESC NULLS LAST
                     LIMIT 50`
                );
                conversations = rows;
            } catch (e) {
                console.error("Admin chat query error:", e.message);
            }

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

            let messages = [];
            try {
                const [rows] = await db.query(
                    `SELECT * FROM messages 
                     WHERE (sender_uuid = $1 OR receiver_uuid = $2)
                     ORDER BY created_at ASC`,
                    [sessionId, sessionId]
                );
                messages = rows;
            } catch(e) {
                console.log("Admin chat query fallback:", e.message);
            }

            const [visitorDetails] = await db.query(
                `SELECT s.id, s.uuid, s.total_points, u.full_name, u.avatar, u.email, u.phone
                 FROM user_sessions s
                 LEFT JOIN users u ON s.user_id = u.id
                 WHERE s.id = $1`,
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
    },

    // ==================== HERO POSTERS ====================
    posters: async (req, res) => {
        try {
            const HeroPoster = require('../models/HeroPoster');
            const posters = await HeroPoster.getAll();
            res.render('admin/posters', {
                title: 'Quản lý Poster Hero Trang Chủ',
                layout: 'layouts/admin',
                posters
            });
        } catch (e) {
            console.error("Admin posters error:", e);
            res.status(500).send("Server Error");
        }
    },

    createPoster: async (req, res) => {
        try {
            const HeroPoster = require('../models/HeroPoster');
            await HeroPoster.ensureTableExists();

            let imageUrl = '/images/placeholder.jpg';
            if (req.body.image_url && req.body.image_url.trim() !== '') {
                imageUrl = req.body.image_url;
            } else if (req.file) {
                try {
                    const cloudResult = await uploadToCloudinary(req.file.buffer, 'hero-posters');
                    imageUrl = cloudResult.secure_url;
                } catch (err) {
                    console.error("Cloudinary poster upload error:", err);
                    imageUrl = 'data:' + req.file.mimetype + ';base64,' + req.file.buffer.toString('base64');
                }
            }

            const posterId = uuidv4();
            const title = req.body.title || 'Poster Hero';
            const sortOrder = parseInt(req.body.sort_order || '1', 10);

            await db.query(
                `INSERT INTO hero_posters (id, title, image_url, sort_order, is_active) VALUES ($1, $2, $3, $4, 1)`,
                [posterId, title, imageUrl, sortOrder]
            );

            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.json({ success: true, message: 'Đã thêm Poster thành công!' });
            }
            res.redirect('/admin/posters');
        } catch (e) {
            console.error("Admin createPoster error:", e);
            if (req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'))) {
                return res.status(500).json({ success: false, message: 'Lỗi: ' + e.message });
            }
            res.status(500).send("Server Error: " + e.message);
        }
    },

    deletePoster: async (req, res) => {
        try {
            const posterId = req.body.id;
            if (posterId) {
                await db.query(`DELETE FROM hero_posters WHERE id = $1`, [posterId]);
            }
            res.redirect('/admin/posters');
        } catch (e) {
            console.error("Admin deletePoster error:", e);
            res.status(500).send("Server Error");
        }
    },

    reorderPosters: async (req, res) => {
        try {
            const { orderedIds } = req.body;
            if (Array.isArray(orderedIds)) {
                for (let i = 0; i < orderedIds.length; i++) {
                    await db.query(`UPDATE hero_posters SET sort_order = $1 WHERE id = $2`, [i + 1, orderedIds[i]]);
                }
            }
            res.json({ success: true, message: 'Đã cập nhật thứ tự Poster!' });
        } catch (e) {
            console.error("Admin reorderPosters error:", e);
            res.status(500).json({ success: false, message: e.message });
        }
    }
};

module.exports = AdminController;
