const Model = require('../core/Model');

class Badge extends Model {
    constructor() {
        super('badges');
    }

    async getAll() {
        return this.findAll('id ASC');
    }

    async getUnlockedBySession(sessionId) {
        const [rows] = await this.db.query(
            `SELECT b.*, ub.created_at as unlocked_at
             FROM user_badges ub
             JOIN badges b ON ub.badge_id = b.id
             WHERE ub.session_id = ?
             ORDER BY ub.created_at DESC`,
            [sessionId]
        );
        return rows;
    }
}

module.exports = new Badge();
