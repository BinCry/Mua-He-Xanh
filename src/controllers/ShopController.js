const db = require('../core/database');
const cache = require('../core/cache');
const { normalizeSearchText, searchTokens, buildTokenSearchClause } = require('../utils/search');

// Shop is a public, contact-first catalogue. It deliberately has no booking,
// capacity or reward side effects; those belong only to Workshop sessions.
const ShopController = {
    async index(req, res) {
        try {
            const typeFilter = typeof req.query.type === 'string' ? req.query.type.trim() : '';
            const searchQuery = String(req.query.q || '').trim().replace(/\s+/g, ' ').slice(0, 100);
            const normalizedSearch = normalizeSearchText(searchQuery);
            const cacheKey = `shops:list:${typeFilter || 'all'}:${normalizedSearch || 'none'}`;
            const typeLabels = {
                nhang: 'Làm nhang', mai: 'Chăm mai', thien: 'Thiền healing',
                banh: 'Bánh dân gian', ecology: 'Sinh thái', culture: 'Văn hóa', other: 'Khác'
            };
            const cached = cache.get(cacheKey);
            if (cached) {
                return res.render('shop/index', {
                    title: 'Shop hàng hóa', workshops: cached, typeFilter, typeLabels, searchQuery
                });
            }

            let query = `
                SELECT w.*, d.name AS destination_name, d.slug AS destination_slug
                FROM workshops w
                LEFT JOIN destinations d ON w.destination_id = d.id
                WHERE w.is_active = 1 AND w.catalog_kind = 'shop'`;
            const params = [];
            let index = 1;
            if (typeFilter) {
                query += ` AND w.type = $${index++}`;
                params.push(typeFilter);
            }
            if (normalizedSearch) {
                const tokens = searchTokens(normalizedSearch);
                const clause = buildTokenSearchClause(['w.title', 'w.description', 'd.name', 'w.type'], normalizedSearch, index);
                const isOnly = (...words) => tokens.length === words.length && words.every(word => tokens.includes(word));
                let matchedType = null;
                if (isOnly('nhang')) matchedType = 'nhang';
                else if (isOnly('mai')) matchedType = 'mai';
                else if (isOnly('thien') || isOnly('healing')) matchedType = 'thien';
                else if (isOnly('banh')) matchedType = 'banh';
                else if (isOnly('sinh', 'thai') || isOnly('ecology')) matchedType = 'ecology';
                else if (isOnly('van', 'hoa') || isOnly('culture')) matchedType = 'culture';

                if (matchedType) {
                    query += ` AND ((${clause.clause}) OR w.type = $${clause.nextIndex})`;
                    params.push(...clause.params, matchedType);
                    index = clause.nextIndex + 1;
                } else {
                    query += ` AND (${clause.clause})`;
                    params.push(...clause.params);
                    index = clause.nextIndex;
                }
            }
            query += ' ORDER BY w.sort_order ASC, w.created_at DESC LIMIT 50';
            const [workshops] = await db.query(query, params);
            cache.set(cacheKey, workshops || [], 180);
            return res.render('shop/index', {
                title: 'Shop hàng hóa', workshops: workshops || [], typeFilter, typeLabels, searchQuery
            });
        } catch (error) {
            console.error('Shop index error:', error);
            return res.status(500).send('Lỗi hệ thống');
        }
    },

    async show(req, res) {
        try {
            const cacheKey = `shops:item:${req.params.id}`;
            let item = cache.get(cacheKey);
            if (!item) {
                const [shopRows] = await db.query(`
                    SELECT w.*, d.name AS destination_name, d.slug AS destination_slug, d.lat, d.lng
                    FROM workshops w
                    LEFT JOIN destinations d ON d.id = w.destination_id
                    WHERE w.id = $1 AND w.catalog_kind = 'shop' AND w.is_active = 1`, [req.params.id]);
                const workshop = shopRows[0];
                if (!workshop) {
                    return res.status(404).render('errors/404', { title: 'Sản phẩm không tồn tại' });
                }
                const [relatedRows] = await db.query(
                    `SELECT * FROM workshops
                     WHERE destination_id = $1 AND is_active = 1 AND catalog_kind = 'shop'
                     ORDER BY sort_order ASC, created_at DESC`, [workshop.destination_id]
                );
                item = { workshop, relatedWorkshops: relatedRows || [] };
                cache.set(cacheKey, item, 180);
            }
            return res.render('shop/show', {
                title: item.workshop.title,
                workshop: item.workshop,
                relatedWorkshops: item.relatedWorkshops.filter(row => row.id !== item.workshop.id)
            });
        } catch (error) {
            console.error('Shop show error:', error);
            return res.status(500).send('Lỗi hệ thống');
        }
    }
};

module.exports = ShopController;
