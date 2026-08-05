const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');
const Destination = require('../models/Destination');

class JourneyController {
    async index(req, res) {
        try {
            const user = req.user || req.session?.user;
            if (!user) {
                req.session.redirectUrl = '/journey';
                return res.redirect('/auth/login?error=auth_required');
            }

            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            const session = await UserSession.findByUuid(uuid);
            if (!session || !session.mood) return res.redirect('/onboarding');

            const journey = await Journey.getActiveBySession(session.id);
            let journeyWithStops;

            if (!journey && session.mood) {
                const interests = session.interests ? JSON.parse(session.interests) : [];
                journeyWithStops = await Journey.createPersonalized(
                    session.id,
                    session.mood,
                    session.duration || '1d',
                    interests
                );
            } else if (journey) {
                journeyWithStops = await Journey.getWithStops(journey.id);
            } else {
                return res.redirect('/onboarding');
            }

            const month = new Date().getMonth() + 1;
            let seasonName = 'Miệt vườn giữa Phố';
            if (month >= 11 || month <= 3) seasonName = 'Du xuân Bình Lợi';

            const allDestinations = await Destination.getActive();

            // Get journey templates from admin
            const [templates] = await UserSession.db.query(
                'SELECT * FROM seasonal_journey_templates ORDER BY created_at DESC'
            );

            res.render('journey/story_mode', {
                title: 'Hành trình của tôi',
                journey: journeyWithStops,
                seasonName: seasonName,
                allDestinations: allDestinations,
                templates: templates || []
            });
        } catch (error) {
            console.error("Journey index error:", error);
            // Catch ECONNRESET or missing session errors and redirect safely to onboarding instead of 500 error
            return res.redirect('/onboarding');
        }
    }

    async suggestions(req, res) {
        try {
            const user = req.user || req.session?.user;
            if (!user) {
                req.session.redirectUrl = '/journey/suggestions';
                return res.redirect('/auth/login?error=auth_required');
            }

            const uuid = req.cookies.session_uuid;
            const session = await UserSession.findByUuid(uuid);
            if (!session || !session.mood) return res.redirect('/onboarding');

            const month = new Date().getMonth() + 1;
            let currentSeason = 'spring';
            if (month >= 4 && month <= 6) currentSeason = 'summer';
            else if (month >= 7 && month <= 9) currentSeason = 'autumn';
            else if (month >= 10 && month <= 12) currentSeason = 'winter';

            const mood = session.mood || 'chill';

            const todayStr = new Date().toISOString().split('T')[0];

            // Query templates, sorting matching valid date range, matching season, and matching mood first
            const [templates] = await UserSession.db.query(
                `SELECT * FROM seasonal_journey_templates 
                 ORDER BY 
                    CASE WHEN (valid_from IS NULL OR valid_from <= ?) AND (valid_until IS NULL OR valid_until >= ?) THEN 0 ELSE 1 END,
                    CASE WHEN season = ? THEN 0 ELSE 1 END,
                    CASE WHEN interest = ? THEN 0 ELSE 1 END,
                    created_at DESC`
                , [todayStr, todayStr, currentSeason, mood]
            );

            // Fetch all active destinations
            const [dests] = await UserSession.db.query("SELECT * FROM destinations WHERE is_active = TRUE");

            let mappedSuggestions = templates.map(t => {
                let stopIds = [];
                try {
                    stopIds = typeof t.stops === 'string' ? JSON.parse(t.stops) : t.stops;
                } catch (e) { }

                let stops = (stopIds || []).map(st => {
                    const stId = (typeof st === 'object') ? (st.id || st.slug) : st;
                    return dests.find(d => String(d.id) === String(stId) || d.slug === String(stId));
                }).filter(Boolean);

                if (stops.length === 0 && dests.length > 0) {
                    stops = dests.slice(0, 3);
                }

                const seasonLabels = {
                    spring: '🌸 Xuân',
                    summer: '☀️ Hạ',
                    autumn: '🍂 Thu',
                    winter: '❄️ Đông'
                };
                const interestLabels = {
                    chill: '🧘 Thư giãn',
                    peace: '🕊️ Bình yên',
                    culture: '🏛️ Văn hóa',
                    family: '👨‍👩‍👧‍👦 Gia đình'
                };

                return {
                    id: t.id,
                    name: t.name,
                    desc: t.description || 'Hành trình trải nghiệm độc đáo tại Bình Lợi',
                    tags: [
                        seasonLabels[t.season] || '🌸 Mùa lễ hội',
                        interestLabels[t.interest] || '🧘 Trải nghiệm'
                    ],
                    duration: t.duration === 'full_day' ? 'Cả ngày' : 'Nửa ngày',
                    km: parseFloat(t.km) || 5.0,
                    stops: stops
                };
            }).filter(Boolean);

            // Fallback templates if none found in DB
            if (mappedSuggestions.length === 0) {
                mappedSuggestions = [
                    {
                        id: 'opt1',
                        name: 'Hành trình Khám phá bản địa',
                        desc: 'Tập trung vào các làng nghề truyền thống và văn hóa đặc trưng.',
                        tags: ['Văn hóa', 'Làng nghề'],
                        duration: '4-5 tiếng',
                        km: 8.5,
                        stops: await Destination.getForJourney(mood, ['craft'], [])
                    },
                    {
                        id: 'opt2',
                        name: 'Hành trình Chữa lành & Xanh',
                        desc: 'Sự kết hợp hoàn hảo giữa không gian xanh và sự tĩnh lặng của thiên nhiên.',
                        tags: ['Sinh thái', 'Thiên nhiên'],
                        duration: '6 tiếng',
                        km: 12.2,
                        stops: await Destination.getForJourney(mood, ['nature'], [])
                    },
                    {
                        id: 'opt3',
                        name: 'Hành trình Tâm linh & Nguồn cội',
                        desc: 'Dành cho những ai tìm kiếm sự bình an tại các ngôi chùa cổ kính.',
                        tags: ['Tâm linh', 'Lịch sử'],
                        duration: '5 tiếng',
                        km: 6.8,
                        stops: await Destination.getForJourney(mood, ['temple'], [])
                    }
                ];
            }

            res.render('journey/suggestions', {
                title: 'Đề xuất hành trình/tour',
                suggestions: mappedSuggestions,
                session: session
            });
        } catch (error) {
            console.error("Suggestions error:", error);
            res.redirect('/onboarding');
        }
    }

    async confirm(req, res) {
        try {
            const user = req.user || req.session?.user;
            if (!user) {
                req.session.redirectUrl = '/journey/suggestions';
                return res.redirect('/auth/login?error=auth_required');
            }

            const uuid = req.cookies.session_uuid;
            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.redirect('/onboarding');

            const { templateId, journeyData } = req.body;

            // 1. Try templateId from DB first
            if (templateId) {
                const [templates] = await UserSession.db.query(
                    "SELECT * FROM seasonal_journey_templates WHERE id = ?",
                    [templateId]
                );
                if (templates.length > 0) {
                    const t = templates[0];
                    let stopIds = [];
                    try {
                        stopIds = typeof t.stops === 'string' ? JSON.parse(t.stops) : t.stops;
                    } catch (e) { }

                    const [dests] = await UserSession.db.query("SELECT * FROM destinations WHERE is_active = TRUE");
                    let stops = [];
                    if (Array.isArray(stopIds)) {
                        stops = stopIds.map(st => {
                            const stId = (typeof st === 'object') ? (st.id || st.slug) : st;
                            return dests.find(d => String(d.id) === String(stId) || d.slug === String(stId));
                        }).filter(Boolean);
                    }

                    if (stops.length === 0 && dests.length > 0) {
                        stops = dests.slice(0, 3);
                    }

                    if (stops.length > 0) {
                        await UserSession.db.query("UPDATE journeys SET status = 'replaced' WHERE session_id = ? AND status = 'active'", [session.id]);

                        const journeyId = await Journey.create({
                            session_id: session.id,
                            mood: t.name,
                            duration: t.duration === 'full_day' ? 'Cả ngày' : 'Nửa ngày',
                            total_km: parseFloat(t.km) || 5.0,
                            total_minutes: t.duration === 'full_day' ? 360 : 180,
                            status: 'active',
                            interests: JSON.stringify([t.season, t.interest])
                        });

                        const JourneyStop = require('../models/JourneyStop');
                        for (let idx = 0; idx < stops.length; idx++) {
                            await JourneyStop.create({
                                journey_id: journeyId,
                                destination_id: stops[idx].id,
                                stop_order: idx,
                                is_completed: 0
                            });
                        }

                        await Journey.recalculateMetrics(journeyId);
                        return res.redirect('/hanh-trinh-cua-toi');
                    }
                }
            }

            // 2. Try journeyData object/string
            if (journeyData) {
                let data = null;
                try {
                    if (typeof journeyData === 'string') {
                        try {
                            const decoded = Buffer.from(journeyData, 'base64').toString('utf-8');
                            data = JSON.parse(decoded);
                        } catch (e) {
                            data = JSON.parse(journeyData);
                        }
                    } else {
                        data = journeyData;
                    }
                } catch (e) {
                    console.error("Parse journeyData error:", e);
                }

                if (data && data.stops && data.stops.length > 0) {
                    await Journey.createFromSuggestion(session.id, data);
                    return res.redirect('/hanh-trinh-cua-toi');
                }
            }

            // 3. Fallback: create personalized journey automatically
            await Journey.createPersonalized(
                session.id,
                session.mood || 'chill',
                session.duration || '1d',
                session.interests ? JSON.parse(session.interests) : []
            );

            return res.redirect('/hanh-trinh-cua-toi');
        } catch (error) {
            console.error("Confirm journey error:", error);
            return res.redirect('/hanh-trinh-cua-toi');
        }
    }

    async loadTemplate(req, res) {
        try {
            const user = req.user || req.session?.user;
            if (!user) {
                return res.redirect('/auth/login?error=auth_required');
            }

            const { id } = req.params;
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.redirect('/onboarding');

            // Find the template in DB
            const [templates] = await UserSession.db.query(
                "SELECT * FROM seasonal_journey_templates WHERE id = ?",
                [id]
            );
            if (templates.length === 0) return res.redirect('/journey');

            const t = templates[0];
            let stopIds = [];
            try {
                stopIds = typeof t.stops === 'string' ? JSON.parse(t.stops) : t.stops;
            } catch (e) { }

            // Load active destinations
            const [dests] = await UserSession.db.query("SELECT * FROM destinations WHERE is_active = TRUE");
            let stops = [];
            if (Array.isArray(stopIds)) {
                stops = stopIds.map(st => {
                    const stId = (typeof st === 'object') ? (st.id || st.slug) : st;
                    return dests.find(d => String(d.id) === String(stId) || d.slug === String(stId));
                }).filter(Boolean);
            }

            if (stops.length === 0 && dests.length > 0) {
                stops = dests.slice(0, 3);
            }

            if (stops.length > 0) {
                // Replaced previous active journey
                await UserSession.db.query("UPDATE journeys SET status = 'replaced' WHERE session_id = ? AND status = 'active'", [session.id]);

                // Create new active journey
                const journeyId = await Journey.create({
                    session_id: session.id,
                    mood: t.name,
                    duration: t.duration === 'full_day' ? 'Cả ngày' : 'Nửa ngày',
                    total_km: parseFloat(t.km) || 5.0,
                    total_minutes: t.duration === 'full_day' ? 360 : 180,
                    status: 'active',
                    interests: JSON.stringify([t.season, t.interest])
                });

                const JourneyStop = require('../models/JourneyStop');
                for (let idx = 0; idx < stops.length; idx++) {
                    await JourneyStop.create({
                        journey_id: journeyId,
                        destination_id: stops[idx].id,
                        stop_order: idx,
                        is_completed: 0
                    });
                }

                await Journey.recalculateMetrics(journeyId);
            }

            res.redirect('/hanh-trinh-cua-toi');
        } catch (error) {
            console.error("Load template error:", error);
            res.redirect('/journey');
        }
    }

    async preset(req, res) {
        try {
            const user = req.user || req.session?.user;
            if (!user) {
                return res.redirect('/auth/login?error=auth_required');
            }

            const { theme } = req.params;
            const uuid = req.cookies.session_uuid;
            if (!uuid) return res.redirect('/onboarding');

            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.redirect('/onboarding');

            await Journey.createPreset(session.id, theme);
            res.redirect('/hanh-trinh-cua-toi');
        } catch (error) {
            console.error("Journey preset error:", error);
            res.redirect('/');
        }
    }
}

module.exports = new JourneyController();
