/**
 * Profile Controller - Pure PostgreSQL
 */
const db = require('../core/database');
const Workshop = require('../models/Workshop');
const CheckIn = require('../models/CheckIn');
const UserBadge = require('../models/UserBadge');
const { v4: uuidv4 } = require('uuid');

const ProfileController = {

    // GET /profile - Hồ sơ cá nhân
    index: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            // Lấy thông tin user đầy đủ từ DB
            const [users] = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
            const fullUser = users[0];

            // Thống kê
            const [checkinCount] = await db.query(`
                SELECT COUNT(*) as total
                FROM check_ins ci
                LEFT JOIN user_sessions us ON ci.session_id = us.id
                WHERE ci.user_id = $1 OR us.user_id = $1
            `, [user.id]);
            const [journeyCount] = await db.query(`
                SELECT COUNT(*) as total FROM journeys j 
                JOIN user_sessions us ON j.session_id = us.session_uuid 
                WHERE us.user_id = $1
            `, [user.id]).catch(() => [[{total: 0}]]);
            const [reviewCount] = await db.query('SELECT COUNT(*) as total FROM reviews WHERE user_id = $1', [user.id]);
            let badges = [];
            try { badges = await UserBadge.getUserBadges(user.id); } catch(e) {}
            let workshopBookings = [];
            try { workshopBookings = await Workshop.getBookingsByUser(user.id); } catch(e) {}

            // Rewards
            let rewards = [];
            try {
                const [rRows] = await db.query(`
                    SELECT ur.*, r.title, r.description, r.type, r.points_required
                    FROM user_rewards ur
                    JOIN rewards r ON ur.reward_id = r.id
                    WHERE ur.user_id = $1
                    ORDER BY ur.redeemed_at DESC
                `, [user.id]);
                rewards = rRows;
            } catch(e) {}

            // Liked destinations
            let likedDestinations = [];
            try {
                const [liked] = await db.query(`
                    SELECT d.id, d.name, d.slug, d.cover_image, d.short_desc, d.type, dl.created_at as liked_at
                    FROM destination_likes dl
                    JOIN destinations d ON dl.destination_id = d.id
                    WHERE dl.user_id = $1 AND d.is_active = 1
                    ORDER BY dl.created_at DESC
                `, [user.id]);
                likedDestinations = liked;
            } catch(e) {}

            // Saved destinations
            let savedDestinations = [];
            try {
                const [saved] = await db.query(`
                    SELECT d.id, d.name, d.slug, d.cover_image, d.short_desc, d.type, uf.created_at as saved_at
                    FROM user_favorites uf
                    JOIN destinations d ON uf.destination_id = d.id
                    WHERE uf.user_id = $1 AND d.is_active = 1
                    ORDER BY uf.created_at DESC
                `, [user.id]);
                savedDestinations = saved;
            } catch(e) {}

            // Saved Journeys
            let savedJourneys = [];
            try {
                const sessionUuid = req.cookies?.session_uuid || '';
                const [journeys] = await db.query(`
                    SELECT DISTINCT j.id, j.mood, j.duration, j.total_km, j.total_minutes, j.status, j.created_at, j.interests,
                           (SELECT COUNT(*) FROM journey_stops js WHERE js.journey_id = j.id) as total_stops
                    FROM journeys j
                    LEFT JOIN user_sessions us ON (j.session_id = us.id::text OR j.session_id = us.uuid)
                    WHERE (us.user_id = $1 OR us.uuid = $2 OR j.session_id = $2 OR j.session_id IN (SELECT id::text FROM user_sessions WHERE user_id = $1) OR j.session_id IN (SELECT uuid FROM user_sessions WHERE user_id = $1))
                      AND j.status NOT IN ('replaced', 'abandoned')
                    ORDER BY j.created_at DESC
                `, [user.id, sessionUuid]);
                savedJourneys = journeys;
            } catch(e) {
                console.error("Fetch savedJourneys error:", e);
            }

            res.render('profile/index', {
                title: 'Hồ sơ Du Khách',
                profileUser: fullUser,
                stats: {
                    checkins: parseInt(checkinCount[0]?.total || 0, 10),
                    journeys: parseInt(journeyCount[0]?.total || 0, 10),
                    reviews: parseInt(reviewCount[0]?.total || 0, 10),
                    badges: badges.length,
                    points: fullUser.total_points || 0,
                    workshopsDone: workshopBookings.filter(b => b.status === 'completed').length
                },
                badges,
                workshopBookings: workshopBookings.slice(0, 5),
                rewards,
                likedDestinations,
                savedDestinations,
                savedJourneys
            });
        } catch (error) {
            console.error('Profile index error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /api/journey/delete - Xóa hành trình đã lưu
    deleteJourney: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });

            const { journeyId } = req.body;
            if (!journeyId) return res.status(400).json({ success: false, message: 'Thiếu ID hành trình' });

            await db.query("DELETE FROM journey_stops WHERE journey_id = $1", [journeyId]);
            await db.query("DELETE FROM journeys WHERE id = $1", [journeyId]);

            res.json({ success: true, message: 'Đã xóa hành trình thành công' });
        } catch(err) {
            console.error("Delete journey error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    },

    // GET /profile/edit
    editPage: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            const [users] = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
            res.render('profile/edit', {
                title: 'Chỉnh sửa hồ sơ',
                profileUser: users[0]
            });
        } catch (error) {
            console.error('Profile edit error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /profile/update
    update: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { full_name, phone, city, preferences, travel_style, avatar } = req.body;

            await db.query(`
                UPDATE users SET full_name = $1, phone = $2, city = $3, preferences = $4, travel_style = $5, avatar = $6
                WHERE id = $7
            `, [full_name, phone, city, preferences, travel_style, avatar, user.id]);

            if (user.role === 'manager' && user.managed_destination_id) {
                await db.query(`
                    UPDATE destinations SET cover_image = $1 WHERE id = $2
                `, [avatar, user.managed_destination_id]);
            }

            if (req.session.user) {
                req.session.user.full_name = full_name;
                req.session.user.avatar = avatar;
            }

            res.json({ success: true, message: 'Cập nhật hồ sơ thành công!' });
        } catch (error) {
            console.error('Profile update error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // GET /profile/rewards
    rewards: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            const [users] = await db.query('SELECT total_points FROM users WHERE id = $1', [user.id]);
            
            let allRewards = [];
            try {
                const [r1] = await db.query('SELECT * FROM rewards WHERE is_active = 1 ORDER BY points_required ASC');
                allRewards = r1;
            } catch(e) {}

            let userRewards = [];
            try {
                const [r2] = await db.query(`
                    SELECT ur.*, r.title, r.type
                    FROM user_rewards ur JOIN rewards r ON ur.reward_id = r.id
                    WHERE ur.user_id = $1 ORDER BY ur.redeemed_at DESC
                `, [user.id]);
                userRewards = r2;
            } catch(e) {}

            res.render('profile/rewards', {
                title: 'Điểm Thưởng',
                currentPoints: users[0]?.total_points || 0,
                availableRewards: allRewards,
                myRewards: userRewards
            });
        } catch (error) {
            console.error('Rewards error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /api/redeem-reward
    redeemReward: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false });

            const { reward_id } = req.body;
            const [rewards] = await db.query('SELECT * FROM rewards WHERE id = $1 AND is_active = 1', [reward_id]);
            if (rewards.length === 0) return res.status(404).json({ success: false, message: 'Phần thưởng không tồn tại' });

            const reward = rewards[0];
            const [users] = await db.query('SELECT total_points FROM users WHERE id = $1', [user.id]);
            const currentPoints = users[0]?.total_points || 0;

            if (currentPoints < reward.points_required) {
                return res.json({ success: false, message: `Bạn cần ${reward.points_required} điểm, hiện có ${currentPoints} điểm` });
            }

            await db.query('INSERT INTO user_rewards (id, user_id, reward_id) VALUES ($1, $2, $3)', [uuidv4(), user.id, reward_id]);
            await db.query('UPDATE users SET total_points = GREATEST(0, COALESCE(total_points, 0) - $1) WHERE id = $2', [reward.points_required, user.id]);
            await db.query('UPDATE rewards SET quantity = GREATEST(0, quantity - 1) WHERE id = $1', [reward_id]);

            res.json({ success: true, message: `Đổi thành công "${reward.title}"! 🎁` });
        } catch (error) {
            console.error('Redeem error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    }
};

module.exports = ProfileController;
