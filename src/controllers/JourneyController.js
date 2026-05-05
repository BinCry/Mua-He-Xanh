const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');

class JourneyController {
    async index(req, res) {
        try {
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            // --- STRATEGY REQUIREMENT: Authentication check ---
            if (!req.session.user) {
                return res.redirect('/auth/login?error=Vui lòng đăng nhập để bắt đầu hành trình của bạn');
            }

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

            // Determine current season
            const month = new Date().getMonth() + 1;
            let seasonName = 'Miệt vườn giữa Phố';
            if (month >= 11 || month <= 3) seasonName = 'Du xuân Bình Lợi';
            else if (month >= 7 && month <= 10) seasonName = 'Lễ hội mùa Thu';

            res.render('journey/story_mode', {
                title: 'Hành trình của tôi',
                journey: journeyWithStops,
                seasonName: seasonName
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

            if (!req.session.user) {
                return res.redirect('/auth/login?error=Vui lòng đăng nhập để bắt đầu hành trình của bạn');
            }

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
