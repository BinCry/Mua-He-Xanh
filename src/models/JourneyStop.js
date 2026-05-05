const Model = require('../core/Model');

class JourneyStop extends Model {
    constructor() {
        super('journey_stops');
    }

    async remove(journeyId, destinationId) {
        return this.db.query(
            `DELETE FROM ${this.table} WHERE journey_id = ? AND destination_id = ?`,
            [journeyId, destinationId]
        );
    }

    async updateOrder(journeyId, destinationId, newOrder) {
        return this.db.query(
            `UPDATE ${this.table} SET stop_order = ? WHERE journey_id = ? AND destination_id = ?`,
            [newOrder, journeyId, destinationId]
        );
    }
}

module.exports = new JourneyStop();
