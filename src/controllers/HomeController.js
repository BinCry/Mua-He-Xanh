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
                {
                    id: 1,
                    user: 'Minh Tuấn',
                    avatar: 'https://i.pravatar.cc/150?u=1',
                    image: '/images/chua-phap-tang-1.png',
                    caption: 'Một buổi sáng thanh tịnh tại Chùa Pháp Tạng. Cảm giác thật an nhiên! #BinhLoiHealing #Zen',
                    likes: 124,
                    location: 'Chùa Pháp Tạng',
                    slug: 'chua-phap-tang'
                },
                {
                    id: 2,
                    user: 'Hà Anh',
                    avatar: 'https://i.pravatar.cc/150?u=2',
                    image: '/images/xuong-nhang-1.png',
                    caption: 'Lần đầu được tự tay làm nhang, mùi thảo mộc thơm dịu cả một vùng. #CraftVillage',
                    likes: 89,
                    location: 'Xưởng Nhang Minh',
                    slug: 'xuong-nhang-minh'
                },
                {
                    id: 3,
                    user: 'Quốc Bảo',
                    avatar: 'https://i.pravatar.cc/150?u=3',
                    image: '/images/cau-chu-z-1.png',
                    caption: 'Hoàng hôn rực rỡ tại Cầu chữ Z. Góc chill không thể bỏ qua tại Bình Lợi.',
                    likes: 215,
                    location: 'Cầu Chữ Z',
                    slug: 'cau-chu-z'
                }
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
