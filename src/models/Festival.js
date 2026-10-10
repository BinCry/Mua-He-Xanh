const Model = require('../core/Model');

class Festival extends Model {
    constructor() {
        super('festivals');
    }

    async findAll() {
        try {
            const [rows] = await this.db.query('SELECT * FROM festivals ORDER BY date ASC');
            return rows;
        } catch (e) {
            return [];
        }
    }

    async createBooking(data) {
        const client = await this.db.pgPool.connect();
        try {
            await client.query('BEGIN');
            const inserted = await client.query(
                `INSERT INTO festival_bookings
                    (id, user_id, festival_id, full_name, phone, tickets, status, reference_code, idempotency_key)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
                 RETURNING id, reference_code, status`,
                [data.id, data.user_id, data.festival_id, data.full_name, data.phone, data.tickets, data.status, data.reference_code, data.idempotency_key]
            );

            if (inserted.rowCount > 0) {
                await client.query('COMMIT');
                return inserted.rows[0];
            }

            const existing = await client.query(
                `SELECT id, reference_code, status, user_id, festival_id, full_name, phone, tickets
                 FROM festival_bookings WHERE idempotency_key = $1 FOR UPDATE`,
                [data.idempotency_key]
            );
            if (existing.rowCount !== 1) throw new Error('Idempotent festival booking was not found after conflict.');
            const prior = existing.rows[0];
            const sameIntent = String(prior.user_id || '') === String(data.user_id || '')
                && String(prior.festival_id) === String(data.festival_id)
                && String(prior.full_name) === String(data.full_name)
                && String(prior.phone) === String(data.phone)
                && Number(prior.tickets) === Number(data.tickets);
            if (!sameIntent) {
                const conflict = new Error('Idempotency key was reused with different festival registration data.');
                conflict.code = 'IDEMPOTENCY_CONFLICT';
                throw conflict;
            }
            await client.query('COMMIT');
            return { id: prior.id, reference_code: prior.reference_code, status: prior.status };
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = new Festival();
