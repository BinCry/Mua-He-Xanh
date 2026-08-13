const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const HeroPoster = require('../models/HeroPoster');
const db = require('../core/database');

// In-memory cache: eliminates DB queries for 5 minutes per serverless instance
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 300000; // 5 minutes

class HomeController {
    async index(req, res) {
        try {
            // Check in-memory RAM cache first
            if (_cache && (Date.now() - _cacheTs < CACHE_TTL)) {
                return res.render('home/index', _cache);
            }

            const heroPostersData = await HeroPoster.getActive();
            const defaultHeroPosters = [
                { id: 'p1', title: 'Poster 1', image_url: '/images/Poster 1.png' },
                { id: 'p2', title: 'Poster 2', image_url: '/images/Poster 2.png' },
                { id: 'p3', title: 'Poster 3', image_url: '/images/Poster 3.png' },
                { id: 'p4', title: 'Poster 4', image_url: '/images/Poster 4.png' },
                { id: 'p5', title: 'Poster 5', image_url: '/images/Poster 5.png' }
            ];
            const heroPosters = (heroPostersData && heroPostersData.length > 0) ? heroPostersData : defaultHeroPosters;

            const [
                featured,
                totalCheckins,
                [pageViewResult],
                [uniqueVisitors],
                [workshopCountResult],
                [avgRatingResult],
                [events],
                [seasonalExperiences],
                [realReviews]
            ] = await Promise.all([
                Destination.getActive(9),
                CheckIn.getTotalCount(),
                db.query('SELECT COUNT(*) as total FROM analytics WHERE event = $1', ['page_view']),
                db.query('SELECT COUNT(DISTINCT session_id) as total FROM analytics WHERE event = $1', ['page_view']),
                db.query('SELECT COUNT(*) as total FROM workshops WHERE is_active = 1'),
                db.query('SELECT AVG(rating) as avg FROM reviews'),
                db.query('SELECT * FROM events WHERE is_active = 1 ORDER BY event_date ASC'),
                db.query('SELECT * FROM seasonal_experiences WHERE is_active = 1 ORDER BY sort_order ASC'),
                db.query(`
                    SELECT r.id, r.content, r.rating, r.images, r.created_at,
                           (SELECT COUNT(*) FROM review_likes WHERE review_id = r.id) as likes_count,
                           (SELECT COUNT(*) FROM review_comments WHERE review_id = r.id) as comments_count,
                           u.full_name, u.avatar,
                           d.name as destination_name, r.location_name
                    FROM (
                        SELECT id FROM reviews ORDER BY created_at DESC LIMIT 6
                    ) sub
                    JOIN reviews r ON sub.id = r.id
                    JOIN users u ON r.user_id = u.id
                    LEFT JOIN destinations d ON r.destination_id = d.id
                    ORDER BY r.created_at DESC
                `)
            ]);

            const settingsMap = res.locals.settings || {};

            const currentDate = new Date();
            const month = currentDate.getMonth() + 1;
            
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

            const totalPageViews = parseInt(pageViewResult[0]?.total || 0, 10);
            const totalVisitors = parseInt(uniqueVisitors[0]?.total || 0, 10);
            const activeDestinations = featured.length;
            const workshopCount = parseInt(workshopCountResult[0]?.total || 50, 10);

            let avgRating = avgRatingResult[0]?.avg || 4.9;
            if (avgRating) {
                avgRating = Math.round(parseFloat(avgRating) * 10) / 10;
            }

            const featuredEvent = events.find(e => e.is_featured === 1) || events.find(e => e.is_countdown === 1) || events[0] || null;
            const nextFestival = {
                name: featuredEvent?.title || "Chưa có sự kiện",
                date: featuredEvent?.event_date || new Date(Date.now() + 86400000 * 30).toISOString(),
                location: featuredEvent?.location || "Bình Lợi"
            };

            const otherEvents = featuredEvent ? events.filter(e => e.id !== featuredEvent.id) : events;

            const renderData = {
                title: 'Bình Lợi - Miền Tây giữa lòng Sài Gòn',
                heroPosters,
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
                reviews: realReviews,
                seasonalExperiences,
                nextEvent: featuredEvent,
                otherEvents
            };

            // Store in RAM cache
            _cache = renderData;
            _cacheTs = Date.now();

            res.render('home/index', renderData);
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
