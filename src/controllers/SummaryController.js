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

            // Load full user if logged in
            let fullUser = null;
            if (session.user_id) {
                const User = require('../models/User');
                fullUser = await User.findById(session.user_id);
            }

            const allBadges = await Badge.getAll();
            const unlockedBadges = await UserBadge.getUnlockedBySession(session.id);
            const history = await CheckIn.getBySession(session.id);

            res.render('summary/index', {
                title: 'Hồ sơ Du khách',
                session: session,
                fullUser: fullUser,
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
