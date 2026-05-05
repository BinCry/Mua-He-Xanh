const Model = require('../core/Model');

class UserSession extends Model {
    constructor() {
        super('user_sessions');
    }

    async findOrCreate(uuid, req = {}) {
        const session = await this.findOne({ uuid });
        if (session) return session;

        const id = await this.create({
            uuid: uuid,
            total_points: 0,
            ip_address: req.ip || '',
            user_agent: req.headers ? req.headers['user-agent'] : '',
        });

        return this.findById(id);
    }

    async findByUuid(uuid) {
        return this.findOne({ uuid });
    }

    async addPoints(id, points) {
        const [result] = await this.db.query(
            `UPDATE ${this.table} SET total_points = total_points + ? WHERE id = ?`,
            [points, id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = new UserSession();
