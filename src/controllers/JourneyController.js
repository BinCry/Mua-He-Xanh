const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');

class JourneyController {
    async index(req, res) {
        try {
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            const session = await UserSession.findByUuid(uuid);
            if (!session || !session.mood) return res.redirect('/onboarding');

            const journey = await Journey.getActiveBySession(session.id);
            let journeyWithStops;

            if (!journey && session.mood) {
                const interests = session.interests ? JSON.parse(session.interests) : [];
                journeyWithStops = await Journey.createPersonalized(
                    session.id, 
                    session.mood, 
                    session.duration || 'morning', 
                    interests
                );
            } else if (journey) {
                journeyWithStops = await Journey.getWithStops(journey.id);
            } else {
                return res.redirect('/onboarding');
            }

            res.render('journey/index', {
                title: 'Gợi ý hành trình',
                journey: journeyWithStops
            });
        } catch (error) {
            console.error("Journey index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    /** Create preset journey */
    async preset(req, res) {
        try {
            const { theme } = req.params;
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.redirect('/onboarding');

            await Journey.createPreset(session.id, theme);
            res.redirect('/journey');
        } catch (error) {
            console.error("Journey preset error:", error);
            res.redirect('/');
        }
    }
}

module.exports = new JourneyController();
