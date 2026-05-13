/**
 * Admin Controller - Chương 7: Hệ thống Admin Tổng
 * Tham khảo AdminController.php từ Relioo (superAdminDashboard, users, departments)
 */
const db = require('../core/database');

const AdminController = {

    // GET /admin — Dashboard tổng (pattern: Relioo superAdminDashboard)
    dashboard: async (req, res) => {
        try {
            // Thống kê tổng quan
            const [userCount] = await db.query('SELECT COUNT(*) as total FROM users');
            const [destCount] = await db.query('SELECT COUNT(*) as total FROM destinations WHERE is_active = TRUE');
            const [checkinCount] = await db.query('SELECT COUNT(*) as total FROM check_ins');
            const [workshopCount] = await db.query('SELECT COUNT(*) as total FROM workshops WHERE is_active = TRUE');
            const [bookingCount] = await db.query('SELECT COUNT(*) as total FROM workshop_bookings');
            const [reviewCount] = await db.query('SELECT COUNT(*) as total FROM reviews');
            const [productCount] = await db.query('SELECT COUNT(*) as total FROM products');
            const [orderCount] = await db.query('SELECT COUNT(*) as total FROM orders');

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
                SELECT id, full_name, email, avatar, role, role_id, created_at
                FROM users ORDER BY created_at DESC LIMIT 10
            `);

            // Recent bookings
            const [recentBookings] = await db.query(`
                SELECT wb.*, w.title as workshop_title, u.full_name as user_name
                FROM workshop_bookings wb
                JOIN workshops w ON wb.workshop_id = w.id
                JOIN users u ON wb.user_id = u.id
                ORDER BY wb.created_at DESC
                LIMIT 10
            `);

            // Revenue stats
            const [revenue] = await db.query(`
                SELECT 
                    COALESCE(SUM(total_price), 0) as workshop_revenue
                FROM workshop_bookings WHERE status IN ('confirmed', 'completed')
            `);
            const [ocopRevenue] = await db.query(`
                SELECT COALESCE(SUM(total_amount), 0) as ocop_revenue
                FROM orders WHERE status IN ('confirmed', 'completed', 'ready')
            `);

            // Monthly check-in trend (last 6 months)
            const [monthlyTrend] = await db.query(`
                SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count
                FROM check_ins
                WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                GROUP BY month ORDER BY month ASC
            `);

            res.render('admin/dashboard', {
                title: 'Bảng Điều Khiển Admin',
                stats: {
                    users: userCount[0].total,
                    destinations: destCount[0].total,
                    checkins: checkinCount[0].total,
                    workshops: workshopCount[0].total,
                    bookings: bookingCount[0].total,
                    reviews: reviewCount[0].total,
                    products: productCount[0].total,
                    orders: orderCount[0].total,
                    workshopRevenue: revenue[0].workshop_revenue,
                    ocopRevenue: ocopRevenue[0].ocop_revenue
                },
                topDests,
                recentUsers,
                recentBookings,
                monthlyTrend
            });
        } catch (error) {
            console.error('Admin dashboard error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // GET /admin/users — Quản lý Users (pattern: Relioo AdminController.users)
    users: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const offset = (page - 1) * limit;
            const search = req.query.q || '';

            let query, countQuery, params;
            if (search) {
                query = `SELECT u.*, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id
                         WHERE u.full_name LIKE ? OR u.email LIKE ? ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
                countQuery = `SELECT COUNT(*) as total FROM users WHERE full_name LIKE ? OR email LIKE ?`;
                params = [`%${search}%`, `%${search}%`, limit, offset];
            } else {
                query = `SELECT u.*, r.role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id
                         ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
                countQuery = `SELECT COUNT(*) as total FROM users`;
                params = [limit, offset];
            }

            const [users] = await db.query(query, params);
            const [countResult] = await db.query(countQuery, search ? [`%${search}%`, `%${search}%`] : []);
            const totalPages = Math.ceil(countResult[0].total / limit);

            const [roles] = await db.query('SELECT * FROM roles ORDER BY id ASC');
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = TRUE');

            res.render('admin/users', {
                title: 'Quản lý Người dùng',
                users, roles, destinations,
                currentPage: page, totalPages,
                searchQuery: search
            });
        } catch (error) {
            console.error('Admin users error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /api/admin/update-user — Cập nhật role/status user (pattern Relioo apiUpdateUser)
    updateUser: async (req, res) => {
        try {
            const { id, role_id, role, is_active, managed_destination_id } = req.body;
            if (!id) return res.status(400).json({ success: false, message: 'Thiếu ID' });

            const roleName = { 1: 'admin', 2: 'manager', 3: 'user', 4: 'guest' };

            await db.query(`
                UPDATE users SET role_id = ?, role = ?, is_active = ?, managed_destination_id = ?
                WHERE id = ?
            `, [role_id, roleName[role_id] || role || 'user', is_active !== undefined ? is_active : 1, managed_destination_id || null, id]);

            res.json({ success: true, message: 'Cập nhật thành công!' });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // POST /api/admin/delete-user — Xóa user (pattern Relioo apiDeleteUser)
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

    // GET /admin/workshops — Quản lý & duyệt Workshop
    workshops: async (req, res) => {
        try {
            const [workshops] = await db.query(`
                SELECT w.*, d.name as destination_name,
                       (SELECT COUNT(*) FROM workshop_bookings wb WHERE wb.workshop_id = w.id) as booking_count,
                       (SELECT AVG(rating) FROM workshop_bookings wb WHERE wb.workshop_id = w.id AND wb.rating IS NOT NULL) as avg_rating
                FROM workshops w
                LEFT JOIN destinations d ON w.destination_id = d.id
                ORDER BY w.created_at DESC
            `);

            res.render('admin/workshops', {
                title: 'Quản lý Workshop',
                workshops
            });
        } catch (error) {
            console.error('Admin workshops error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // GET /admin/reviews — Duyệt Reviews
    reviews: async (req, res) => {
        try {
            const [reviews] = await db.query(`
                SELECT r.*, u.full_name, u.avatar, d.name as destination_name
                FROM reviews r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN destinations d ON r.destination_id = d.id
                ORDER BY r.created_at DESC
                LIMIT 50
            `);

            res.render('admin/reviews', {
                title: 'Duyệt Đánh Giá',
                reviews
            });
        } catch (error) {
            console.error('Admin reviews error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // GET /admin/settings — Quản lý cấu hình trang chủ
    getSettings: async (req, res) => {
        try {
            const [settings] = await db.query('SELECT * FROM settings ORDER BY category ASC');
            
            // Group settings by category
            const grouped = settings.reduce((acc, s) => {
                if (!acc[s.category]) acc[s.category] = [];
                acc[s.category].push(s);
                return acc;
            }, {});

            res.render('admin/settings', {
                title: 'Cấu hình Trang chủ',
                grouped
            });
        } catch (error) {
            console.error('Admin settings error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /api/admin/update-settings
    updateSettings: async (req, res) => {
        try {
            const settings = req.body; // Expecting { key_name: value, ... }
            
            for (const [key, val] of Object.entries(settings)) {
                await db.query('UPDATE settings SET key_value = ? WHERE key_name = ?', [val, key]);
            }

            res.json({ success: true, message: 'Đã cập nhật cấu hình!' });
        } catch (error) {
            console.error('Update settings error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },
    
    // GET /admin/products — Quản lý Sản phẩm OCOP
    products: async (req, res) => {
        try {
            const [products] = await db.query('SELECT * FROM products ORDER BY created_at DESC');
            res.render('admin/products', {
                title: 'Quản lý Sản phẩm',
                products
            });
        } catch (error) {
            console.error('Admin products error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /api/admin/update-product
    updateProduct: async (req, res) => {
        try {
            const { id, name, price, description, image_url, category, is_active } = req.body;
            await db.query(`
                UPDATE products SET name = ?, price = ?, description = ?, image_url = ?, category = ?, is_active = ?
                WHERE id = ?
            `, [name, price, description, image_url, category, is_active, id]);
            res.json({ success: true, message: 'Đã cập nhật sản phẩm!' });
        } catch (error) {
            console.error('Update product error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    }
};

module.exports = AdminController;
