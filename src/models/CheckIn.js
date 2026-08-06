const Model = require('../core/Model');

class CheckIn extends Model {
    constructor() {
        super('check_ins');
    }

    async existsForStop(sessionId, destinationId) {
        const row = await this.findOne({ session_id: sessionId, destination_id: destinationId });
        return row !== null;
    }

    async getBySession(sessionId) {
        const [rows] = await this.db.query(
            `SELECT ci.*, d.name, d.slug, d.type, d.cover_image, d.points as dest_points
             FROM ${this.table} ci
             JOIN destinations d ON ci.destination_id = d.id
             WHERE ci.session_id = $1
             ORDER BY ci.created_at DESC`,
            [sessionId]
        );
        return rows;
    }

    async countTodayBySession(sessionId) {
        const [rows] = await this.db.query(
            `SELECT COUNT(*) as cnt FROM ${this.table} WHERE session_id = $1 AND DATE(created_at) = CURRENT_DATE`,
            [sessionId]
        );
        return parseInt(rows[0]?.cnt || 0, 10);
    }

    async getTotalCount() {
        const [rows] = await this.db.query(`SELECT COUNT(*) as cnt FROM ${this.table}`);
        return parseInt(rows[0]?.cnt || 0, 10);
    }
}

module.exports = new CheckIn();
