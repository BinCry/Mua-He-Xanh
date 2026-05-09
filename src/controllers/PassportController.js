const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const UserBadge = require('../models/UserBadge');

class PassportController {
    async index(req, res) {
        try {
            const user = req.user;
            if (!user) return res.redirect('/auth/login');

            // Get all check-ins for the user
            const checkins = await CheckIn.getByUser(user.id);
            const stamps = await Destination.getActive(100);
            
            // Map checkins to stamps
            const collectedStamps = stamps.map(s => {
                const found = checkins.find(c => c.destination_id === s.id);
                return {
                    ...s,
                    is_collected: !!found,
                    collected_at: found ? found.created_at : null
                };
            });

            // Get badges
            const badges = await UserBadge.getByUser(user.id);

            // Missions Mockup
            const missions = [
                { id: 1, name: 'Người khám phá sơ cấp', desc: 'Check-in tại 3 địa điểm bất kỳ', progress: Math.min(100, (collectedStamps.filter(s => s.is_collected).length / 3) * 100), reward: '500 PTS' },
                { id: 2, name: 'Sứ giả Làng nghề', desc: 'Tham gia workshop làm nhang', progress: collectedStamps.some(s => s.slug === 'xuong-nhang-minh' && s.is_collected) ? 100 : 0, reward: 'Badge: Skillful' },
                { id: 3, name: 'Người giữ hồn quê', desc: 'Đi đủ 3 mùa tại Bình Lợi', progress: 33, reward: '1000 PTS' }
            ];

            res.render('passport/index', {
                title: 'Passport Du Lịch Điện Tử | Bình Lợi',
                stamps: collectedStamps,
                badges: badges,
                user: user,
                missions: missions,
                stats: {
                    total_stamps: collectedStamps.length,
                    collected_count: collectedStamps.filter(s => s.is_collected).length,
                    points: user.points || 1250, // Augmented for demonstration
                    level: Math.floor((user.points || 1250) / 1000) + 1
                }
            });
        } catch (error) {
            console.error("Passport index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new PassportController();
