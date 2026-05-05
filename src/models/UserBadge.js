const Model = require('../core/Model');
const Badge = require('./Badge');
const UserSession = require('./UserSession');
const CheckIn = require('./CheckIn');

class UserBadge extends Model {
    constructor() {
        super('user_badges');
    }

    async hasUnlocked(sessionId, badgeId) {
        const row = await this.findOne({ session_id: sessionId, badge_id: badgeId });
        return row !== null;
    }

    async unlock(sessionId, badgeId) {
        return this.create({ session_id: sessionId, badge_id: badgeId });
    }

    async getUnlockedBySession(sessionId) {
        const [rows] = await this.db.query(
            `SELECT b.* FROM badges b 
             JOIN user_badges ub ON b.id = ub.badge_id 
             WHERE ub.session_id = ?`,
            [sessionId]
        );
        return rows;
    }

    async checkAndUnlock(sessionId) {
        const allBadges = await Badge.getAll();
        const session = await UserSession.findById(sessionId);
        const checkins = await CheckIn.getBySession(sessionId);
        const todayCount = await CheckIn.countTodayBySession(sessionId);

        const newBadges = [];
        for (const badge of allBadges) {
            if (await this.hasUnlocked(sessionId, badge.id)) continue;

            let condition = {};
            try {
                condition = JSON.parse(badge.condition || '{}');
            } catch (e) {}

            let unlocked = false;

            switch (condition.type) {
                case 'first_journey_complete':
                    const [rows] = await this.db.query(
                        "SELECT COUNT(*) as cnt FROM journeys WHERE session_id = ? AND status = 'completed'",
                        [sessionId]
                    );
                    unlocked = rows[0].cnt >= 1;
                    break;

                case 'checkins_same_day':
                    unlocked = todayCount >= (condition.count || 3);
                    break;

                case 'total_points':
                    unlocked = (session.total_points || 0) >= (condition.min_points || 100);
                    break;

                case 'total_checkins':
                    unlocked = checkins.length >= (condition.count || 6);
                    break;

                case 'destination_type_count':
                    const typeCount = checkins.filter(c => c.type === (condition.dest_type || '')).length;
                    unlocked = typeCount >= (condition.min_count || 2);
                    break;

                case 'multi_type_journey':
                    const types = [...new Set(checkins.map(c => c.type))];
                    const required = condition.types || [];
                    unlocked = required.every(t => types.includes(t));
                    break;
            }

            if (unlocked) {
                await this.unlock(sessionId, badge.id);
                await UserSession.addPoints(sessionId, badge.points || 0);
                newBadges.push(badge);
            }
        }
        return newBadges;
    }
}

module.exports = new UserBadge();
