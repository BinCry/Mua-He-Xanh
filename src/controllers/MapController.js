const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');

class MapController {
    async index(req, res) {
        try {
            const Destination = require('../models/Destination');
            const allDests = await Destination.findAll();

            const uuid = req.cookies ? req.cookies.session_uuid : null;
            let journeyWithStops = null;
            if (uuid) {
                const session = await UserSession.findByUuid(uuid);
                if (session) {
                    const journey = await Journey.getActiveBySession(session.id);
                    if (journey) {
                        journeyWithStops = await Journey.getWithStops(journey.id);
                    }
                }
            }

            res.render('map/index', {
                title: 'Bản đồ Tương tác Bình Lợi',
                destinations: allDests,
                journey: journeyWithStops
            });
        } catch (error) {
            console.error("Map index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new MapController();
