const Model = require('../core/Model');

class CheckIn extends Model {
    constructor() {
        super('check_ins');
    }

    /**
     * Check if user checked in at this destination within the last X hours (default 24h)
     */
    async existsRecentCheckIn(sessionId, destinationId, userId = null, hours = 24) {
        let query, params;
        if (userId) {
            query = `
                SELECT id, created_at FROM ${this.table}
                WHERE (session_id = $1 OR user_id = $2)
                  AND destination_id = $3
                  AND created_at >= NOW() - INTERVAL '${parseInt(hours, 10)} hours'
                ORDER BY created_at DESC LIMIT 1
            `;
            params = [sessionId, userId, destinationId];
        } else {
            query = `
                SELECT id, created_at FROM ${this.table}
                WHERE session_id = $1
                  AND destination_id = $2
                  AND created_at >= NOW() - INTERVAL '${parseInt(hours, 10)} hours'
                ORDER BY created_at DESC LIMIT 1
            `;
            params = [sessionId, destinationId];
        }
        const [rows] = await this.db.query(query, params);
        return rows.length > 0 ? rows[0] : null;
    }

    async existsForStop(sessionId, destinationId, userId = null) {
        const recent = await this.existsRecentCheckIn(sessionId, destinationId, userId, 24);
        return recent !== null;
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

    /**
     * Credit historical check-ins that predate account-linked point updates.
     * Setting user_id and awarding the points happen in the same statement;
     * the `user_id IS NULL` guard makes this safe to run more than once.
     */
    async backfillLinkedUserPoints() {
        const [rows] = await this.db.query(`
            WITH linked_checkins AS (
                UPDATE ${this.table} ci
                SET user_id = us.user_id
                FROM user_sessions us
                WHERE ci.session_id = us.id
                  AND ci.user_id IS NULL
                  AND us.user_id IS NOT NULL
                RETURNING ci.user_id, COALESCE(ci.points_earned, 0) AS points_earned
            ),
            earned_points AS (
                SELECT user_id, SUM(points_earned) AS total_points
                FROM linked_checkins
                GROUP BY user_id
            ),
            updated_users AS (
                UPDATE users u
                SET total_points = COALESCE(u.total_points, 0) + ep.total_points,
                    updated_at = CURRENT_TIMESTAMP
                FROM earned_points ep
                WHERE u.id = ep.user_id
                RETURNING u.id
            )
            SELECT COUNT(*)::int AS updated_users FROM updated_users
        `);
        return parseInt(rows[0]?.updated_users || 0, 10);
    }
}

module.exports = new CheckIn();
