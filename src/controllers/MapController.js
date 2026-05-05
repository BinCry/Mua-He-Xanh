const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');

class MapController {
    async index(req, res) {
        try {
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.redirect('/onboarding');

            const journey = await Journey.getActiveBySession(session.id);
            if (!journey) return res.redirect('/onboarding');
            
            const journeyWithStops = await Journey.getWithStops(journey.id);

            res.render('map/index', {
                title: 'Bản đồ cảm xúc',
                journey: journeyWithStops
            });
        } catch (error) {
            console.error("Map index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new MapController();
