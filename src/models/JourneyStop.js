const Model = require('../core/Model');

class JourneyStop extends Model {
    constructor() {
        super('journey_stops');
    }

    async findByJourney(journeyId) {
        return this.findWhere({ journey_id: journeyId }, 'stop_order ASC');
    }

    /** Update stop by journey and destination IDs */
    async updateByJourneyAndDest(journeyId, destinationId, data) {
        const sets = [];
        const params = [];
        let index = 1;
        for (const [col, val] of Object.entries(data)) {
            sets.push(`${col} = $${index++}`);
            params.push(val);
        }
        params.push(journeyId, destinationId);
        const setStr = sets.join(', ');
        return this.db.query(
            `UPDATE journey_stops SET ${setStr} WHERE journey_id = $${index++} AND destination_id = $${index++}`,
            params
        );
    }

    async remove(journeyId, destinationId) {
        return this.db.query(
            `DELETE FROM ${this.table} WHERE journey_id = $1 AND destination_id = $2`,
            [journeyId, destinationId]
        );
    }

    async updateOrder(journeyId, destinationId, newOrder) {
        return this.db.query(
            `UPDATE ${this.table} SET stop_order = $1 WHERE journey_id = $2 AND destination_id = $3`,
            [newOrder, journeyId, destinationId]
        );
    }
}

module.exports = new JourneyStop();
