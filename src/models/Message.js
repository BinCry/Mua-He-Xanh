const Model = require('../core/Model');

class Message extends Model {
    constructor() {
        super('messages');
    }

    async getByDestination(destId) {
        const [rows] = await this.db.query(
            "SELECT m.*, s.uuid as sender_uuid FROM messages m LEFT JOIN user_sessions s ON m.sender_id = s.id WHERE m.destination_id = $1 ORDER BY m.created_at DESC",
            [destId]
        );
        return rows;
    }
}

module.exports = new Message();
