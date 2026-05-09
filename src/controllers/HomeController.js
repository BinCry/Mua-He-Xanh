const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');

class HomeController {
    async index(req, res) {
        try {
            // Determine current season and campaign
            const now = new Date();
            const month = now.getMonth() + 1;
            
            let season = 'summer';
            let seasonTitle = 'Bình Lợi – Miền Tây giữa lòng Sài Gòn';
            let seasonSlogan = 'Miệt vườn giữa phố, trải nghiệm bản sắc';
            let heroVideo = '/videos/summer_healing.mp4'; // Fallback to placeholder if not exists

            if (month >= 11 || month <= 3) {
                season = 'spring';
                seasonTitle = 'Xuân Bình Lợi – Sắc Mai Vàng';
                seasonSlogan = 'Hồn quê giữa thành phố mới';
                heroVideo = '/videos/spring_mai.mp4';
            } else if (month >= 7 && month <= 10) {
                season = 'autumn';
                seasonTitle = 'Mùa Hoa Đăng – Bình Lợi Chữa Lành';
                seasonSlogan = 'Bình từ tâm – Lợi từ tầm';
                heroVideo = '/videos/autumn_healing.mp4';
            }

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
                { user: 'Minh Anh', location: 'Chùa Pháp Tạng', text: 'Không gian thật tịnh tâm, cảm ơn Bình Lợi!', image: '/images/social1.jpg', time: '2 giờ trước' },
                { user: 'Hoàng Long', location: 'Xưởng Nhang Minh', text: 'Workshop làm nhang rất thú vị.', image: '/images/social2.jpg', time: '5 giờ trước' },
                { user: 'Thảo Vy', location: 'Vườn Mai Bình Lợi', text: 'Mai năm nay nở sớm quá đẹp.', image: '/images/social3.jpg', time: '1 ngày trước' }
            ];

            res.render('home/index', {
                title: 'Bình Lợi – Miền Tây giữa lòng Sài Gòn',
                featured: featured,
                season: {
                    type: season,
                    title: seasonTitle,
                    slogan: seasonSlogan,
                    video: heroVideo
                },
                festival: nextFestival,
                stats: {
                    checkins: (totalCheckins || 0) + 5240,
                    destinations: activeDestinations,
                    visitors: 18500,
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
