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

            // Find session by UUID or user.id
            let session = null;
            const uuid = req.cookies.session_uuid;
            if (uuid) {
                session = await UserSession.findByUuid(uuid);
            }
            if (!session) {
                const [rows] = await UserSession.db.query(
                    "SELECT * FROM user_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
                    [user.id]
                );
                if (rows.length > 0) {
                    session = rows[0];
                }
            }

            if (!session) {
                // Create a temporary/new session if none exists
                const { v4: uuidv4 } = require('uuid');
                const newUuid = uuidv4();
                res.cookie('session_uuid', newUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
                session = await UserSession.findOrCreate(newUuid, req);
                await UserSession.db.query("UPDATE user_sessions SET user_id = ? WHERE id = ?", [user.id, session.id]);
            }

            // Run check and unlock badges dynamically before displaying
            await UserBadge.checkAndUnlock(session.id);

            // 1. Get check-in history
            const history = await CheckIn.getBySession(session.id);
            
            // 2. Get unlocked badges
            const unlockedBadges = await UserBadge.getUnlockedBySession(session.id);
            
            // 3. Get all available badges
            const allBadges = await Badge.getAll();

            // 4. Calculate Level & XP
            const totalPoints = session.total_points || 0;
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
