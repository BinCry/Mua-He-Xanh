const db = require('../core/database');
const { normalizeSearchText, buildTokenSearchClause } = require('../utils/search');

function pagination(query) {
    const limit = Number(query.limit ?? 10);
    const offset = Number(query.offset ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20 ||
        !Number.isInteger(offset) || offset < 0 || offset > 10000) {
        throw new RangeError('INVALID_PAGINATION');
    }
    return { limit, offset };
}

async function list(req, res, kind) {
    try {
        const { limit, offset } = pagination(req.query);
        const query = String(req.query.q || '').trim().slice(0, 100);
        const search = buildTokenSearchClause(
            ['w.title', 'w.description', 'd.name'], normalizeSearchText(query), 1
        );
        const params = [...search.params];
        if (kind === 'workshops' && req.query.from && req.query.until &&
            new Date(req.query.from) >= new Date(req.query.until)) {
            throw new RangeError('INVALID_DATE_INTERVAL');
        }
        let sql = kind === 'products'
            ? `SELECT w.id, w.title, w.description, w.price AS price_vnd, d.name AS destination_name
               FROM workshops w LEFT JOIN destinations d ON d.id = w.destination_id
               WHERE w.is_active = 1 AND w.catalog_kind = 'shop'`
            : `SELECT ws.id, w.id AS workshop_id, w.title, w.description, d.name AS destination_name,
                      ws.starts_at, ws.ends_at, ws.price_vnd,
                      GREATEST(0, ws.capacity - ws.reserved_seats) AS available_seats
               FROM workshop_sessions ws JOIN workshops w ON w.id = ws.workshop_id
               JOIN destinations d ON d.id = w.destination_id
               WHERE ws.is_active = TRUE AND w.is_active = 1 AND d.is_active = 1
                 AND w.catalog_kind = 'workshop' AND ws.starts_at > NOW()`;
        if (search.clause) sql += ` AND (${search.clause})`;
        for (const [field, operator] of [['from', '>='], ['until', '<']]) {
            if (kind !== 'workshops' || !req.query[field]) continue;
            const date = new Date(req.query[field]);
            if (!Number.isFinite(date.getTime())) throw new RangeError('INVALID_DATE');
            params.push(date.toISOString());
            sql += ` AND ws.starts_at ${operator} $${params.length}`;
        }
        sql += kind === 'products' ? ' ORDER BY w.id ASC' : ' ORDER BY ws.starts_at ASC, ws.id ASC';
        params.push(limit + 1, offset);
        sql += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
        const [rows] = await db.query(sql, params);
        const items = rows.slice(0, limit).map(row => ({
            ...row,
            url: kind === 'products' ? `/shops/${row.id}` : `/workshops/${row.workshop_id}`,
            ...(kind === 'products' ? { purchase_method: 'contact', price_vnd: Number(row.price_vnd) > 0 ? row.price_vnd : null } : {})
        }));
        const hasMore = rows.length > limit;
        return res.json({ success: true, data: {
            items, hasMore, nextOffset: hasMore ? offset + limit : null,
            observedAt: new Date().toISOString()
        } });
    } catch (error) {
        const invalid = error instanceof RangeError;
        return res.status(invalid ? 400 : 503).json({ success: false,
            error: { code: invalid ? error.message : 'CATALOG_UNAVAILABLE' } });
    }
}

module.exports = {
    products: (req, res) => list(req, res, 'products'),
    workshops: (req, res) => list(req, res, 'workshops')
};
