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
        const [result] = await this.db.query(
            `UPDATE ${this.table} SET total_points = total_points + $1 WHERE id = $2`,
            [points, id]
        );
        return (result.affectedRows || result.rowCount || 0) > 0;
    }
}

module.exports = new UserSession();
