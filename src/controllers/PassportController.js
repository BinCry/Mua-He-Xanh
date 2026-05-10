const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const UserBadge = require('../models/UserBadge');
const Badge = require('../models/Badge');
const UserSession = require('../models/UserSession');

class PassportController {
    async index(req, res) {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            // 1. Get check-in history
            const history = await CheckIn.getHistoryBySession(user.id);
            
            // 2. Get unlocked badges
            const unlockedBadges = await UserBadge.getUnlockedBySession(user.id);
            
            // 3. Get all available badges
            const allBadges = await Badge.findAll();

            // 4. Calculate Level & XP
            // Base XP = 100 per check-in + points from destinations
            const totalPoints = user.total_points || 0;
            const xp = (history.length * 50) + totalPoints;
            const level = Math.floor(xp / 500) + 1;
            const nextLevelXp = level * 500;
            const progress = Math.min(100, Math.round((xp % 500) / 500 * 100));

            // 5. Generate Passport Number
            const passportNum = `BL-${user.id.substring(0, 4).toUpperCase()}-${new Date(user.created_at || Date.now()).getFullYear()}`;

            res.render('passport/index', {
                title: 'Passport Số Bình Lợi',
                user: user,
                history: history,
                unlockedBadges: unlockedBadges,
                allBadges: allBadges,
                level: level,
                xp: xp,
                nextLevelXp: nextLevelXp,
                progress: progress,
                passportNum: passportNum
            });
        } catch (error) {
            console.error("Passport index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new PassportController();
