const UserSession = require('../models/UserSession');
const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');
const CheckIn = require('../models/CheckIn');

class SummaryController {
    async index(req, res) {
        try {
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.redirect('/onboarding');

            const allBadges = await Badge.getAll();
            const unlockedBadges = await UserBadge.getUnlockedBySession(session.id);
            const history = await CheckIn.getBySession(session.id);

            res.render('summary/index', {
                title: 'Hộ chiếu Du lịch Bình Lợi',
                session: session,
                allBadges: allBadges,
                unlockedBadges: unlockedBadges,
                history: history
            });
        } catch (error) {
            console.error("Summary index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new SummaryController();
