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
                    user: 'Phạm Minh',
                    avatar: 'https://i.pravatar.cc/150?u=1',
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
