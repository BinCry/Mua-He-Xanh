const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');
const HeroPoster = require('../models/HeroPoster');
const db = require('../core/database');

// In-memory cache: eliminates DB queries for 5 minutes per serverless instance
let _cache = null;
let _cacheTs = 0;
const CACHE_TTL = 300000; // 5 minutes

const DEFAULT_HOME_DATA = {
    title: 'Bình Lợi - Miền Tây giữa lòng Sài Gòn',
    heroPosters: [
        { id: 'p1', title: 'Poster 1', image_url: '/uploads/posters/poster-1.webp' },
        { id: 'p2', title: 'Poster 2', image_url: '/uploads/posters/poster-2.webp' },
        { id: 'p3', title: 'Poster 3', image_url: '/uploads/posters/poster-3.webp' },
        { id: 'p4', title: 'Poster 4', image_url: '/uploads/posters/poster-4.webp' },
        { id: 'p5', title: 'Poster 5', image_url: '/uploads/posters/poster-5.webp' }
    ],
    featured: [],
    season: { type: 'summer', title: 'Bình Lợi - Miền Tây giữa lòng Sài Gòn', slogan: 'Miệt vườn giữa phố, trải nghiệm bản sắc' },
    festival: { name: 'Lễ Hội Mai Vàng Bình Lợi', date: new Date(Date.now() + 86400000 * 30).toISOString(), location: 'Bình Lợi' },
    stats: { checkins: 0, pageViews: 0, visitors: 0, destinations: 10, workshopCount: 12, avgRating: 5.0 },
    reviews: [],
    seasonalExperiences: [],
    nextEvent: null,
    otherEvents: []
};

class HomeController {
    async index(req, res) {
        try {
            // Check in-memory RAM cache first
            if (_cache && (Date.now() - _cacheTs < CACHE_TTL)) {
                try {
                    const [[pv], [uv], totalCheckins] = await Promise.all([
                        db.query('SELECT COUNT(*) as total FROM analytics').catch(() => [[{ total: 0 }]]),
                        db.query('SELECT COUNT(DISTINCT session_id) as total FROM analytics').catch(() => [[{ total: 0 }]]),
                        CheckIn.getTotalCount().catch(() => 0)
                    ]);
                    if (_cache.stats) {
                        _cache.stats.checkins = totalCheckins ?? 0;
                        _cache.stats.pageViews = parseInt(pv[0]?.total ?? 0, 10);
                        _cache.stats.visitors = parseInt(uv[0]?.total ?? 0, 10);
                    }
                } catch (e) {}
                return res.render('home/index', _cache);
            }

            const heroPostersData = await HeroPoster.getActive().catch(() => null);
            const defaultHeroPosters = DEFAULT_HOME_DATA.heroPosters;
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
                Destination.getActive(9).catch(() => []),
                CheckIn.getTotalCount().catch(() => 0),
                db.query('SELECT COUNT(*) as total FROM analytics').catch(() => [[{ total: 0 }]]),
                db.query('SELECT COUNT(DISTINCT session_id) as total FROM analytics').catch(() => [[{ total: 0 }]]),
                db.query('SELECT COUNT(*) as total FROM workshops WHERE is_active = 1').catch(() => [[{ total: 12 }]]),
                db.query('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews').catch(() => [[{ avg: null, count: 0 }]]),
                db.query('SELECT * FROM events WHERE is_active = 1 ORDER BY event_date ASC').catch(() => [[]]),
                db.query('SELECT * FROM seasonal_experiences WHERE is_active = 1 ORDER BY sort_order ASC').catch(() => [[]]),
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
                `).catch(() => [[]])
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

            const totalPageViews = parseInt(pageViewResult[0]?.total ?? 0, 10);
            const totalVisitors = parseInt(uniqueVisitors[0]?.total ?? 0, 10);
            const activeDestinations = (featured && featured.length > 0) ? featured.length : 10;
            const workshopCount = parseInt(workshopCountResult[0]?.total ?? 0, 10);

            const reviewCount = parseInt(avgRatingResult[0]?.count ?? 0, 10);
            let avgRating = '-/-';
            if (reviewCount > 0 && avgRatingResult[0]?.avg !== null) {
                avgRating = (Math.round(parseFloat(avgRatingResult[0].avg) * 10) / 10).toFixed(1);
            }

            const safeEvents = Array.isArray(events) ? events : [];
            const featuredEvent = safeEvents.find(e => e.is_featured == 1 || e.is_featured === true || e.is_featured === '1') || 
                                  safeEvents.find(e => e.is_countdown == 1 || e.is_countdown === true || e.is_countdown === '1') || 
                                  safeEvents[0] || null;
            const nextFestival = {
                name: featuredEvent?.title || "Chưa có sự kiện",
                date: featuredEvent?.event_date || new Date(Date.now() + 86400000 * 30).toISOString(),
                location: featuredEvent?.location || "Bình Lợi"
            };

            const otherEvents = featuredEvent ? safeEvents.filter(e => e.id !== featuredEvent.id) : safeEvents;

            const renderData = {
                title: 'Bình Lợi - Miền Tây giữa lòng Sài Gòn',
                heroPosters,
                featured: (featured && featured.length > 0) ? featured : DEFAULT_HOME_DATA.featured,
                season: { type: season, title: seasonTitle, slogan: seasonSlogan },
                festival: nextFestival,
                stats: {
                    checkins: totalCheckins ?? 0,
                    pageViews: totalPageViews,
                    visitors: totalVisitors,
                    destinations: activeDestinations,
                    workshopCount,
                    avgRating
                },
                reviews: Array.isArray(realReviews) ? realReviews : [],
                seasonalExperiences: Array.isArray(seasonalExperiences) ? seasonalExperiences : [],
                nextEvent: featuredEvent,
                otherEvents
            };

            // Only cache if featured has destinations
            if (featured && featured.length > 0) {
                _cache = renderData;
                _cacheTs = Date.now();
            }
            res.render('home/index', renderData);
        } catch (error) {
            console.error("Home index error:", error);
            res.render('home/index', _cache || DEFAULT_HOME_DATA);
        }
    }

    clearCache() {
        _cache = null;
        _cacheTs = 0;
    }
}

module.exports = new HomeController();
