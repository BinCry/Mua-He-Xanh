const Model = require('../core/Model');

class JourneyStop extends Model {
    constructor() {
        super('journey_stops');
    }

    async findByJourney(journeyId) {
        return this.find({ journey_id: journeyId });
    }

    /** Update stop by journey and destination IDs */
    async updateByJourneyAndDest(journeyId, destinationId, data) {
        return this.db.query(
            "UPDATE journey_stops SET ? WHERE journey_id = ? AND destination_id = ?",
            [data, journeyId, destinationId]
        );
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
