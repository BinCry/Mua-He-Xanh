const Model = require('../core/Model');
const sessionCache = new Map();
const SESSION_TTL = 300000; // 5 minutes RAM cache

class UserSession extends Model {
    constructor() {
        super('user_sessions');
    }

    async findOrCreate(uuid, req = {}) {
        if (!uuid) return null;
        
        const cached = sessionCache.get(uuid);
        if (cached && (Date.now() - cached.time < SESSION_TTL)) {
            return cached.data;
        }

        let session = await this.findOne({ uuid });
        if (!session) {
            const id = await this.create({
                uuid: uuid,
                total_points: 0,
                ip_address: req.ip || '',
                user_agent: req.headers ? req.headers['user-agent'] : '',
            });
            session = await this.findById(id);
        }

        if (session) {
            sessionCache.set(uuid, { time: Date.now(), data: session });
        }
        return session;
    }

    async findByUuid(uuid) {
        return this.findOrCreate(uuid);
    }

    async addPoints(id, points) {
        // Keep the guest/session balance and the linked account balance in sync.
        // A single PostgreSQL statement makes both updates atomic.
        const [rows] = await this.db.query(
            `WITH updated_session AS (
                UPDATE ${this.table}
                SET total_points = COALESCE(total_points, 0) + $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING user_id
            ),
            updated_user AS (
                UPDATE users
                SET total_points = COALESCE(total_points, 0) + $1,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = (
                    SELECT user_id FROM updated_session
                    WHERE user_id IS NOT NULL
                    LIMIT 1
                )
                RETURNING id
            )
            SELECT EXISTS(SELECT 1 FROM updated_session) AS session_updated,
                   (SELECT id FROM updated_user LIMIT 1) AS user_id`,
            [points, id]
        );
        return rows[0]?.session_updated === true;
    }
}

module.exports = new UserSession();
