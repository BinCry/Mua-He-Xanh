const db = require('../core/database');

class WorkshopController {
    async index(req, res) {
        try {
            const search = String(req.query.q || '').trim();
            const params = [];
            let sql = 'SELECT ws.id AS session_id, ws.starts_at, ws.ends_at, ws.price_vnd, ws.capacity, ws.reserved_seats, ' +
                'w.id AS workshop_id, w.title, w.description, w.image, d.name AS destination_name ' +
                'FROM workshop_sessions ws JOIN workshops w ON w.id = ws.workshop_id ' +
                'LEFT JOIN destinations d ON d.id = w.destination_id ' +
                'WHERE ws.is_active = TRUE AND w.is_active = 1 AND ws.starts_at > NOW()';
            if (search) {
                params.push('%' + search + '%');
                sql += ' AND (w.title ILIKE $1 OR w.description ILIKE $1 OR d.name ILIKE $1)';
            }
            sql += ' ORDER BY ws.starts_at ASC LIMIT 100';
            const [sessions] = await db.query(sql, params);
            return res.render('workshops/index', {
                title: 'Workshop trải nghiệm',
                sessions,
                searchQuery: search
            });
        } catch (error) {
            console.error('Workshop index error:', error);
            return res.status(500).render('errors/500', { title: 'Lỗi hệ thống' });
        }
    }

    async show(req, res) {
        try {
            const [workshops] = await db.query(
                'SELECT w.*, d.name AS destination_name FROM workshops w LEFT JOIN destinations d ON d.id = w.destination_id ' +
                'WHERE w.id = $1 AND w.is_active = 1',
                [req.params.id]
            );
            const workshop = workshops[0];
            if (!workshop) return res.status(404).render('errors/404', { title: 'Workshop không tồn tại' });
            const [sessions] = await db.query(
                'SELECT id, starts_at, ends_at, price_vnd, capacity, reserved_seats FROM workshop_sessions ' +
                'WHERE workshop_id = $1 AND is_active = TRUE AND starts_at > NOW() ORDER BY starts_at ASC',
                [workshop.id]
            );
            return res.render('workshops/show', { title: workshop.title, workshop, sessions });
        } catch (error) {
            console.error('Workshop show error:', error);
            return res.status(500).render('errors/500', { title: 'Lỗi hệ thống' });
        }
    }
}

module.exports = new WorkshopController();
