const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const db = require('../core/database');

class HomeController {
    async index(req, res) {
        try {
            // Get settings from database
            const [rows] = await db.query("SELECT * FROM settings WHERE category IN ('home', 'stats')");
            const settings = rows.reduce((acc, row) => {
                acc[row.key_name] = row.key_value;
                return acc;
            }, {});

            // Determine current season and campaign
            const now = new Date();
            const month = now.getMonth() + 1;
            
            let seasonType = 'summer';
            if (month >= 11 || month <= 3) seasonType = 'spring';
            else if (month >= 7 && month <= 10) seasonType = 'autumn';

            const seasonData = {
                type: seasonType,
                title: settings[`home_hero_${seasonType}_title`] || 'Bình Lợi – Miền Tây giữa lòng Sài Gòn',
                slogan: settings[`home_hero_${seasonType}_slogan`] || 'Miệt vườn giữa phố, trải nghiệm bản sắc',
                video: settings[`home_hero_${seasonType}_video`] || `/videos/${seasonType}_healing.mp4`
            };

            // Get featured destinations
            const featured = await Destination.getActive(6);

            // Community stats
            const totalCheckins = await CheckIn.getTotalCount();
            const activeDestinations = (await Destination.getActive(100)).length;

            // Festival Data (Mocked for now)
            const nextFestival = {
                name: "Lễ hội Mai Vàng Bình Lợi 2026",
                date: "2026-02-15T08:00:00",
                location: "Làng nghề Mai Vàng"
            };

            // Social Feed Mockup (Trending Check-ins)
            const socialFeed = [
                {
                    id: 1,
                    user: 'Phạm Minh',
                    avatar: 'https://i.pravatar.cc/150?u=1',
                    image: '/images/hero-1.jpg',
                    text: 'Bình yên là khi được nghe tiếng chuông chùa Pháp Tạng vang vọng giữa sớm mai. Một trải nghiệm thật sự chữa lành tâm hồn.',
                    location: 'Chùa Pháp Tạng',
                    slug: 'chua-phap-tang',
                    time: '1 giờ trước',
                    likes: 156
                },
                {
                    id: 2,
                    user: 'Khánh Vy',
                    avatar: 'https://i.pravatar.cc/150?u=2',
                    image: '/images/xuong-nhang-3.jpg',
                    text: 'Lần đầu tiên được tận mắt thấy quy trình làm nhang thủ công. Mùi hương thảo mộc thật sự rất dễ chịu.',
                    location: 'Xưởng Nhang Minh',
                    slug: 'xuong-nhang-minh',
                    time: '3 giờ trước',
                    likes: 89
                },
                {
                    id: 3,
                    user: 'Đức Anh',
                    avatar: 'https://i.pravatar.cc/150?u=3',
                    image: '/images/hero-2.jpg',
                    text: 'Hoàng hôn tại Cầu chữ Z chưa bao giờ làm mình thất vọng. Một góc chill cực phẩm ngay tại Bình Lợi.',
                    location: 'Cầu Chữ Z',
                    slug: 'cau-chu-z',
                    time: '5 giờ trước',
                    likes: 234
                }
            ];

            res.render('home/index', {
                title: 'Bình Lợi – Miền Tây giữa lòng Sài Gòn',
                featured: featured,
                season: seasonData,
                festival: nextFestival,
                stats: {
                    checkins: (totalCheckins || 0) + parseInt(settings.home_stats_checkins_offset || 5240),
                    destinations: activeDestinations,
                    visitors: parseInt(settings.home_stats_visitors || 18500),
                    communities: 12
                },
                socialFeed: socialFeed
            });
        } catch (error) {
            console.error("Home index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new HomeController();
