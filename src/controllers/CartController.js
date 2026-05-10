/**
 * Cart Controller - Chương 5.12: Khu OCOP & Mua sắm
 * Giỏ hàng, đặt online, nhận tại địa điểm
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const NotificationController = require('./NotificationController');

const CartController = {

    // GET /cart — Giỏ hàng
    index: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            const [items] = await db.query(`
                SELECT ci.*, p.name, p.price, p.image, p.origin, p.category
                FROM cart_items ci
                JOIN products p ON ci.product_id = p.id
                WHERE ci.user_id = ?
                ORDER BY ci.created_at DESC
            `, [user.id]);

            const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

            res.render('cart/index', {
                title: 'Giỏ hàng OCOP',
                items,
                total
            });
        } catch (error) {
            console.error('Cart index error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /api/cart/add — Thêm vào giỏ
    add: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });

            const { product_id, quantity } = req.body;

            // Check existing
            const [existing] = await db.query(
                'SELECT id, quantity FROM cart_items WHERE user_id = ? AND product_id = ?',
                [user.id, product_id]
            );

            if (existing.length > 0) {
                await db.query('UPDATE cart_items SET quantity = quantity + ? WHERE id = ?',
                    [quantity || 1, existing[0].id]);
            } else {
                await db.query(
                    'INSERT INTO cart_items (id, user_id, product_id, quantity) VALUES (?, ?, ?, ?)',
                    [uuidv4(), user.id, product_id, quantity || 1]
                );
            }

            // Get cart count
            const [countResult] = await db.query(
                'SELECT COUNT(*) as count FROM cart_items WHERE user_id = ?', [user.id]
            );

            res.json({ success: true, message: 'Đã thêm vào giỏ hàng! 🛒', cartCount: countResult[0].count });
        } catch (error) {
            console.error('Cart add error:', error);
            res.status(500).json({ success: false, message: 'Lỗi' });
        }
    },

    // POST /api/cart/update — Cập nhật số lượng
    update: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false });

            const { item_id, quantity } = req.body;
            if (quantity <= 0) {
                await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [item_id, user.id]);
            } else {
                await db.query('UPDATE cart_items SET quantity = ? WHERE id = ? AND user_id = ?',
                    [quantity, item_id, user.id]);
            }
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    // POST /api/cart/remove — Xóa khỏi giỏ
    remove: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false });

            await db.query('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [req.body.item_id, user.id]);
            res.json({ success: true, message: 'Đã xóa' });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    // POST /api/cart/checkout — Đặt hàng
    checkout: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { pickup_location, note } = req.body;

            // Get cart items
            const [items] = await db.query(`
                SELECT ci.*, p.name, p.price FROM cart_items ci
                JOIN products p ON ci.product_id = p.id
                WHERE ci.user_id = ?
            `, [user.id]);

            if (items.length === 0) {
                return res.json({ success: false, message: 'Giỏ hàng trống' });
            }

            const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
            const orderItems = items.map(i => ({ name: i.name, quantity: i.quantity, price: i.price }));

            const orderId = uuidv4();
            await db.query(
                'INSERT INTO orders (id, user_id, items, total_amount, pickup_location, note) VALUES (?, ?, ?, ?, ?, ?)',
                [orderId, user.id, JSON.stringify(orderItems), total, pickup_location || 'Tại chỗ', note]
            );

            // Clear cart
            await db.query('DELETE FROM cart_items WHERE user_id = ?', [user.id]);

            // Award points
            await db.query('UPDATE users SET total_points = COALESCE(total_points, 0) + 30 WHERE id = ?', [user.id]);

            // Send notification
            const orderCode = orderId.substring(0, 8).toUpperCase();
            await NotificationController.create(
                user.id, 'voucher',
                `Đơn hàng OCOP #${orderCode}`,
                `Đặt ${items.length} sản phẩm, tổng ${new Intl.NumberFormat('vi-VN').format(total)}đ. Nhận tại: ${pickup_location || 'Tại chỗ'}. +30 điểm`,
                '/my-orders'
            );

            res.json({
                success: true,
                message: `Đặt hàng thành công! Mã: #${orderCode}. +30 điểm 🎁`,
                orderId
            });
        } catch (error) {
            console.error('Checkout error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // GET /my-orders — Lịch sử đơn hàng
    orders: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            const [orders] = await db.query(
                'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [user.id]
            );

            // Parse JSON items
            orders.forEach(o => {
                try { o.itemList = JSON.parse(o.items); } catch(e) { o.itemList = []; }
            });

            res.render('cart/orders', {
                title: 'Đơn hàng của tôi',
                orders
            });
        } catch (error) {
            console.error('Orders error:', error);
            res.status(500).send('Lỗi');
        }
    }
};

module.exports = CartController;
