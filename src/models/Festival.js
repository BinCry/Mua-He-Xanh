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
        // Assume there is a table festival_bookings (created in migrate_v2.js as festivals booking logic)
        // Wait, I created 'festivals' table but not 'festival_bookings'.
        // I'll create it now.
        await this.db.query(`
            CREATE TABLE IF NOT EXISTS festival_bookings (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                festival_id VARCHAR(36),
                full_name VARCHAR(255),
                phone VARCHAR(20),
                tickets INT,
                status VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        const { id, user_id, festival_id, full_name, phone, tickets, status } = data;
        await this.db.query(
            "INSERT INTO festival_bookings (id, user_id, festival_id, full_name, phone, tickets, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [id, user_id, festival_id, full_name, phone, tickets, status]
        );
    }
}

module.exports = new Festival();
