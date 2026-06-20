const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const db = require('../core/database');

class HomeController {
    async index(req, res) {
        try {
            const user = req.user || req.session.user;
            if (user) {
                if (user.role === 'admin') {
                    return res.redirect('/admin');
                }
                if (user.role === 'manager') {
                    return res.redirect('/manager');
                }
            }

            // Get all settings from DB
            const [dbSettings] = await db.query('SELECT * FROM settings');
            const settingsMap = {};
            dbSettings.forEach(s => { settingsMap[s.key_name] = s.key_value; });

            // Determine current season
            const now = new Date();
            const month = now.getMonth() + 1;
            
            let season = 'summer';
            let seasonTitle = settingsMap.hero_title || 'Bình Lợi - Miền Tây giữa lòng Sài Gòn';
            let seasonSlogan = settingsMap.hero_slogan || 'Miệt vườn giữa phố, trải nghiệm bản sắc';

            if (month >= 11 || month <= 3) {
                season = 'spring';
                if (!settingsMap.hero_title) {
                    seasonTitle = 'Xuân Bình Lợi - Sắc Mai Vàng';
                    seasonSlogan = 'Hồn quê giữa thành phố mới';
                }
            } else if (month >= 7 && month <= 10) {
                season = 'autumn';
                if (!settingsMap.hero_title) {
                    seasonTitle = 'Mùa Hoa Đăng - Bình Lợi Chữa Lành';
                    seasonSlogan = 'Bình từ tâm - Lợi từ tầm';
                }
            }

            // Get featured destinations
            const featured = await Destination.getActive(6);

            // REAL stats from database
            const totalCheckins = await CheckIn.getTotalCount();
            const activeDestinations = (await Destination.getActive(100)).length;
            
            // Real page views count
            const [pageViewResult] = await db.query('SELECT COUNT(*) as total FROM analytics WHERE event = ?', ['page_view']);
            const totalPageViews = pageViewResult[0]?.total || 0;

            // Real unique visitors (by session_id)
            const [uniqueVisitors] = await db.query('SELECT COUNT(DISTINCT session_id) as total FROM analytics WHERE event = ?', ['page_view']);
            const totalVisitors = uniqueVisitors[0]?.total || 0;

            // Real workshops count
            const [workshopCountResult] = await db.query('SELECT COUNT(*) as total FROM workshops WHERE is_active = 1');
            const workshopCount = workshopCountResult[0]?.total || 50;

            // Real average rating from reviews
            const [avgRatingResult] = await db.query('SELECT AVG(rating) as avg FROM reviews');
            let avgRating = avgRatingResult[0]?.avg || 4.9;
            if (avgRating) {
                avgRating = Math.round(parseFloat(avgRating) * 10) / 10;
            }

            // Festival/Events from DB (admin managed) - query is_countdown = 1 first, fallback to nearest upcoming active event
            let [events] = await db.query(`
                SELECT * FROM events 
                WHERE is_active = 1 AND is_countdown = 1 
                LIMIT 1
            `);
            if (events.length === 0) {
                [events] = await db.query(`
                    SELECT * FROM events 
                    WHERE is_active = 1 AND event_date > NOW() 
                    ORDER BY event_date ASC LIMIT 1
                `);
            }
            const nextEvent = events[0] || null;
            const nextFestival = {
                name: nextEvent?.title || "Chưa có sự kiện",
                date: nextEvent?.event_date || new Date(Date.now() + 86400000 * 30).toISOString(),
                location: nextEvent?.location || "Bình Lợi"
            };

            // Seasonal experiences from DB (admin managed)
            const [seasonalExperiences] = await db.query(`
                SELECT * FROM seasonal_experiences 
                WHERE is_active = 1 
                ORDER BY sort_order ASC
            `);

            // Real Social Feed - actual reviews from community
            const [realReviews] = await db.query(`
                SELECT r.*, u.full_name, u.avatar, d.name as destination_name
                FROM reviews r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN destinations d ON r.destination_id = d.id
                ORDER BY r.created_at DESC LIMIT 6
            `);

            const socialFeed = realReviews.map(r => {
                let firstImage = null;
                if (r.images) {
                    try { firstImage = JSON.parse(r.images)[0] || null; } catch(e) {}
                }
                return {
                    id: r.id,
                    user: r.full_name,
                    avatar: r.avatar || '/images/default-avatar.png',
                    text: r.content,
                    location: r.destination_name || r.location_name || 'Bình Lợi',
                    time: getRelativeTime(r.created_at),
                    likes: r.likes_count || 0,
                    image: firstImage
                };
            });

            res.render('home/index', {
                title: 'Bình Lợi - Miền Tây giữa lòng Sài Gòn',
                featured,
                season: { type: season, title: seasonTitle, slogan: seasonSlogan },
                festival: nextFestival,
                stats: {
                    checkins: totalCheckins || 0,
                    pageViews: totalPageViews,
                    visitors: totalVisitors,
                    destinations: activeDestinations,
                    workshopCount,
                    avgRating
                },
                socialFeed,
                seasonalExperiences,
                nextEvent
            });
        } catch (error) {
            console.error("Home index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

function getRelativeTime(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} ngày trước`;
    return new Date(date).toLocaleDateString('vi-VN');
}

module.exports = new HomeController();
