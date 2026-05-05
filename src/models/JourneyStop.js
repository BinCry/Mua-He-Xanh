const Model = require('../core/Model');

class JourneyStop extends Model {
    constructor() {
        super('journey_stops');
    }
}

module.exports = new JourneyStop();
