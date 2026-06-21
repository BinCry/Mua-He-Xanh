/**
 * Profile Controller - Chương 5.2: Hồ sơ Du khách
 * Tham khảo ProfileController.php từ Relioo (updateProfile, getById)
 */
const db = require('../core/database');
const Workshop = require('../models/Workshop');
const CheckIn = require('../models/CheckIn');
const UserBadge = require('../models/UserBadge');

const ProfileController = {

    // GET /profile - Hồ sơ cá nhân
    index: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            // Lấy thông tin user đầy đủ từ DB
            const [users] = await db.query('SELECT * FROM users WHERE id = ?', [user.id]);
            const fullUser = users[0];

            // Thống kê
            const [checkinCount] = await db.query('SELECT COUNT(*) as total FROM check_ins WHERE user_id = ?', [user.id]);
            const [journeyCount] = await db.query(`
                SELECT COUNT(*) as total FROM journeys j 
                JOIN user_sessions us ON j.session_id = us.session_uuid 
                WHERE us.user_id = ?
            `, [user.id]).catch(() => [[{total: 0}]]);
            const [reviewCount] = await db.query('SELECT COUNT(*) as total FROM reviews WHERE user_id = ?', [user.id]);
            let badges = [];
            try { badges = await UserBadge.getUserBadges(user.id); } catch(e) {}
            let workshopBookings = [];
            try { workshopBookings = await Workshop.getBookingsByUser(user.id); } catch(e) {}

            // Rewards
            const [rewards] = await db.query(`
                SELECT ur.*, r.title, r.description, r.type, r.points_required
                FROM user_rewards ur
                JOIN rewards r ON ur.reward_id = r.id
                WHERE ur.user_id = ?
                ORDER BY ur.redeemed_at DESC
            `, [user.id]);

            res.render('profile/index', {
                title: 'Hồ sơ Du Khách',
                profileUser: fullUser,
                stats: {
                    checkins: checkinCount[0]?.total || 0,
                    journeys: journeyCount[0]?.total || 0,
                    reviews: reviewCount[0]?.total || 0,
                    badges: badges.length,
                    points: fullUser.total_points || 0,
                    workshopsDone: workshopBookings.filter(b => b.status === 'completed').length
                },
                badges,
                workshopBookings: workshopBookings.slice(0, 5),
                rewards
            });
        } catch (error) {
            console.error('Profile index error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // GET /profile/edit - Form chỉnh sửa (pattern Relioo updateProfile)
    editPage: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            const [users] = await db.query('SELECT * FROM users WHERE id = ?', [user.id]);
            res.render('profile/edit', {
                title: 'Chỉnh sửa hồ sơ',
                profileUser: users[0]
            });
        } catch (error) {
            console.error('Profile edit error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /profile/update - Cập nhật hồ sơ (API JSON pattern Relioo)
    update: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { full_name, phone, city, preferences, travel_style, avatar } = req.body;

            await db.query(`
                UPDATE users SET full_name = ?, phone = ?, city = ?, preferences = ?, travel_style = ?, avatar = ?
                WHERE id = ?
            `, [full_name, phone, city, preferences, travel_style, avatar, user.id]);

            // Sync to destination cover image if the user is a manager
            if (user.role === 'manager' && user.managed_destination_id) {
                await db.query(`
                    UPDATE destinations SET cover_image = ? WHERE id = ?
                `, [avatar, user.managed_destination_id]);
            }

            // Update session
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

    // GET /profile/rewards - Điểm thưởng & đổi quà (Chương 5.15)
    rewards: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.redirect('/auth/login');

            const [users] = await db.query('SELECT total_points FROM users WHERE id = ?', [user.id]);
            const [allRewards] = await db.query('SELECT * FROM rewards WHERE is_active = TRUE ORDER BY points_required ASC');
            const [userRewards] = await db.query(`
                SELECT ur.*, r.title, r.type
                FROM user_rewards ur JOIN rewards r ON ur.reward_id = r.id
                WHERE ur.user_id = ? ORDER BY ur.redeemed_at DESC
            `, [user.id]);

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

    // POST /api/redeem-reward - Đổi điểm lấy quà
    redeemReward: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false });

            const { reward_id } = req.body;
            const [rewards] = await db.query('SELECT * FROM rewards WHERE id = ? AND is_active = TRUE', [reward_id]);
            if (rewards.length === 0) return res.status(404).json({ success: false, message: 'Phần thưởng không tồn tại' });

            const reward = rewards[0];
            const [users] = await db.query('SELECT total_points FROM users WHERE id = ?', [user.id]);
            const currentPoints = users[0]?.total_points || 0;

            if (currentPoints < reward.points_required) {
                return res.json({ success: false, message: `Bạn cần ${reward.points_required} điểm, hiện có ${currentPoints} điểm` });
            }

            const { v4: uuidv4 } = require('uuid');
            await db.query('INSERT INTO user_rewards (id, user_id, reward_id) VALUES (?, ?, ?)', [uuidv4(), user.id, reward_id]);
            await db.query('UPDATE users SET total_points = total_points - ? WHERE id = ?', [reward.points_required, user.id]);
            await db.query('UPDATE rewards SET quantity = quantity - 1 WHERE id = ?', [reward_id]);

            res.json({ success: true, message: `Đổi thành công "${reward.title}"! 🎁` });
        } catch (error) {
            console.error('Redeem error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    }
};

module.exports = ProfileController;
