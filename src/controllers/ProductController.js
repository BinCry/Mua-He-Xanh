const db = require('../core/database');
const { normalizeSearchText, buildTokenSearchClause } = require('../utils/search');

class ProductController {
    async index(req, res) {
        try {
            const searchQuery = String(req.query.q || '').trim().replace(/\s+/g, ' ').slice(0, 100);
            const search = normalizeSearchText(searchQuery);
            const params = [];
            let sql = 'SELECT p.id, p.title, p.description, p.price_vnd, p.stock_on_hand, p.reserved_stock, d.name AS destination_name ' +
                'FROM products p LEFT JOIN destinations d ON d.id = p.destination_id WHERE p.is_active = TRUE';
            if (search) {
                const searchClause = buildTokenSearchClause(['p.title', 'p.description', 'd.name'], search, 1);
                sql += ` AND (${searchClause.clause})`;
                params.push(...searchClause.params);
            }
            sql += ' ORDER BY p.created_at DESC LIMIT 100';
            const [products] = await db.query(sql, params);
            return res.render('products/index', {
                title: 'Shop hàng hóa',
                products,
                searchQuery
            });
        } catch (error) {
            console.error('Product index error:', error);
            return res.status(500).render('errors/500', { title: 'Lỗi hệ thống' });
        }
    }

    async show(req, res) {
        try {
            const [products] = await db.query(
                'SELECT p.*, d.name AS destination_name FROM products p LEFT JOIN destinations d ON d.id = p.destination_id ' +
                'WHERE p.id = $1 AND p.is_active = TRUE',
                [req.params.id]
            );
            const product = products[0];
            if (!product) return res.status(404).render('errors/404', { title: 'Sản phẩm không tồn tại' });
            return res.render('products/show', { title: product.title, product });
        } catch (error) {
            console.error('Product show error:', error);
            return res.status(500).render('errors/500', { title: 'Lỗi hệ thống' });
        }
    }
}

module.exports = new ProductController();
