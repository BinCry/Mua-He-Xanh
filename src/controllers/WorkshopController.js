const db = require('../core/database');
const { normalizeSearchText, buildTokenSearchClause } = require('../utils/search');

class WorkshopController {
    async index(req, res) {
        try {
            const searchQuery = String(req.query.q || '').trim().replace(/\s+/g, ' ').slice(0, 100);
            const search = normalizeSearchText(searchQuery);
            const params = [];
            let sql = 'SELECT ws.id AS session_id, ws.starts_at, ws.ends_at, ws.price_vnd, ws.capacity, ws.reserved_seats, ' +
                'w.id AS workshop_id, w.title, w.description, w.image, d.name AS destination_name ' +
                'FROM workshop_sessions ws JOIN workshops w ON w.id = ws.workshop_id ' +
                'LEFT JOIN destinations d ON d.id = w.destination_id ' +
                "WHERE ws.is_active = TRUE AND w.is_active = 1 AND w.catalog_kind = 'workshop' AND ws.starts_at > NOW()";
            const searchClause = buildTokenSearchClause(['w.title', 'w.description', 'd.name'], search, 1);
            if (searchClause.clause) {
                sql += ` AND (${searchClause.clause})`;
                params.push(...searchClause.params);
            }
            sql += ' ORDER BY ws.starts_at ASC LIMIT 100';
            const [sessions] = await db.query(sql, params);
            return res.render('workshops/index', {
                title: 'Workshop trải nghiệm',
                sessions,
                searchQuery
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
                "WHERE w.id = $1 AND w.is_active = 1 AND w.catalog_kind = 'workshop'",
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

    async myBookings(req, res) {
        try {
            const user = req.user || req.session?.user;
            const [bookings] = await db.query(
                `SELECT b.id, b.seats, b.status, b.created_at, b.confirmed_at, b.completed_at, b.cancelled_at,
                        b.title_snapshot, b.price_vnd_snapshot, ws.starts_at, ws.ends_at,
                        w.title AS workshop_title, d.name AS destination_name
                 FROM workshop_session_bookings b
                 JOIN workshop_sessions ws ON ws.id = b.session_id
                 JOIN workshops w ON w.id = ws.workshop_id AND w.catalog_kind = 'workshop'
                 LEFT JOIN destinations d ON d.id = w.destination_id
                 WHERE b.user_id = $1
                 ORDER BY ws.starts_at DESC, b.created_at DESC`,
                [user.id]
            );
            return res.render('workshops/my-bookings', { title: 'Booking Workshop của tôi', bookings });
        } catch (error) {
            console.error('Workshop booking history error:', error);
            return res.status(500).render('errors/500', { title: 'Lỗi hệ thống' });
        }
    }
}

module.exports = new WorkshopController();
