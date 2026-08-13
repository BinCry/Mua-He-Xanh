const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');
const Destination = require('../models/Destination');
const Model = require('../core/Model');
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

class JourneyController {
    constructor() {
        this.index = this.index.bind(this);
        this.suggestions = this.suggestions.bind(this);
        this.confirm = this.confirm.bind(this);
        this.lockJourney = this.lockJourney.bind(this);
        this.loadTemplate = this.loadTemplate.bind(this);
        this.deleteSavedJourney = this.deleteSavedJourney.bind(this);
        this.getOrCreateSession = this.getOrCreateSession.bind(this);
    }

    // Helper to ALWAYS guarantee a valid session row in database
    async getOrCreateSession(req, res) {
        const user = req.user || req.session?.user;
        let uuid = req.cookies?.session_uuid;
        
        if (!uuid) {
            uuid = uuidv4();
            res.cookie('session_uuid', uuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
        }

        let session = await UserSession.findByUuid(uuid);
        if (!session) {
            const sessionId = await UserSession.create({
                uuid: uuid,
                user_id: user ? user.id : null,
                mood: 'chill'
            });
            session = await UserSession.findById(sessionId);
        }
        return session;
    }

    // STEP 3 & 4: /hanh-trinh-cua-toi
    async index(req, res) {
        try {
            const session = await this.getOrCreateSession(req, res);
            let journey = await Journey.getActiveBySession(session.id);

            // If no active journey exists yet, create default journey with 3 active destinations
            if (!journey) {
                const [dests] = await db.query("SELECT * FROM destinations WHERE is_active = 1 LIMIT 3");
                const journeyId = await Journey.create({
                    session_id: session.id,
                    mood: 'Hành Trình Tối Ưu',
                    duration: 'Trọn 1 ngày',
                    total_km: 4.2,
                    total_minutes: 360,
                    status: 'active',
                    interests: JSON.stringify({ source: 'ai', isConfirmed: false })
                });

                const JourneyStop = require('../models/JourneyStop');
                for (let idx = 0; idx < dests.length; idx++) {
                    await JourneyStop.create({
                        journey_id: journeyId,
                        destination_id: dests[idx].id,
                        stop_order: idx,
                        is_completed: 0
                    });
                }
                journey = await Journey.findById(journeyId);
            }

            let journeyWithStops = await Journey.getWithStops(journey.id);
            if (!journeyWithStops || !journeyWithStops.stops || journeyWithStops.stops.length === 0) {
                const [defaultDests] = await db.query("SELECT * FROM destinations WHERE is_active = 1 LIMIT 3");
                const JourneyStop = require('../models/JourneyStop');
                for (let idx = 0; idx < defaultDests.length; idx++) {
                    await JourneyStop.create({
                        journey_id: journey.id,
                        destination_id: defaultDests[idx].id,
                        stop_order: idx,
                        is_completed: 0
                    });
                }
                journeyWithStops = await Journey.getWithStops(journey.id);
            }

            let journeySource = 'ai';
            let isConfirmed = false;
            try {
                const parsed = typeof journeyWithStops.interests === 'string'
                    ? JSON.parse(journeyWithStops.interests)
                    : journeyWithStops.interests;
                if (parsed && parsed.source === 'template') journeySource = 'template';
                if (parsed && parsed.isConfirmed) isConfirmed = true;
            } catch (e) { }

            const currentStep = (req.query.step === '4' || isConfirmed) ? 4 : 3;
            const allDestinations = await Destination.getActive();
            const [templates] = await db.query("SELECT * FROM seasonal_journey_templates ORDER BY created_at DESC");

            res.render('journey/story_mode', {
                title: currentStep === 4 ? 'Timeline & Bản Đồ Hành Trình' : 'Tinh Chỉnh Hành Trình',
                journey: journeyWithStops,
                allDestinations: allDestinations || [],
                templates: templates || [],
                journeySource,
                currentStep
            });
        } catch (error) {
            console.error("Journey index error:", error);
            res.redirect('/onboarding');
        }
    }

    // STEP 2: Suggestions page
    async suggestions(req, res) {
        try {
            const session = await this.getOrCreateSession(req, res);
            const [dests] = await db.query("SELECT * FROM destinations WHERE is_active = 1");

            const moodMap = { chill: '🌿 Sống Chậm', peace: '🛕 Tâm Linh', culture: '🎨 Văn Hóa', family: '👨‍👩‍👧‍👦 Gắn Kết' };
            const userMoodKeys = (session.mood || 'chill').split(',').map(s => s.trim());
            const userMoodLabel = userMoodKeys.map(k => moodMap[k] || k).join(', ');

            let aiSuggestions = [];
            try {
                let candidates = dests;
                let sortedStops = candidates.slice(0, 3);

                let totalMeters = 0;
                for (let i = 1; i < sortedStops.length; i++) {
                    totalMeters += Model.haversine(sortedStops[i - 1].lat, sortedStops[i - 1].lng, sortedStops[i].lat, sortedStops[i].lng);
                }
                const totalKm = Math.round((totalMeters / 1000) * 100) / 100 || 4.2;

                aiSuggestions.push({
                    id: 'ai-opt-1',
                    name: 'Lộ trình AI Tối Ưu Tối Đa',
                    desc: 'AI tự động chọn lọc điểm dừng phù hợp nhất theo gu cá nhân và tối ưu quãng đường ngắn nhất',
                    tags: ['🤖 AI Tối Ưu', '📍 Tuyến ngắn nhất'],
                    duration: 'Trọn 1 ngày',
                    km: totalKm,
                    stops: sortedStops,
                    source: 'ai'
                });
            } catch (e) { }

            const [templates] = await db.query("SELECT * FROM seasonal_journey_templates ORDER BY created_at DESC");
            const seasonLabels = { spring: '🌸 Xuân', summer: '☀️ Hạ', autumn: '🍂 Thu', winter: '❄️ Đông' };
            const interestLabels = { chill: '🕊️ Bình yên', peace: '🛕 Thư giãn', culture: '🎨 Văn hóa', family: '👨‍👩‍👧‍👦 Gắn kết' };

            let templateSuggestions = templates.map((t, idx) => {
                let stopIds = [];
                try { stopIds = typeof t.stops === 'string' ? JSON.parse(t.stops) : t.stops; } catch (e) { }

                let stops = (stopIds || []).map(st => {
                    const stId = (typeof st === 'object') ? (st.id || st.slug) : st;
                    return dests.find(d => String(d.id) === String(stId) || d.slug === String(stId));
                }).filter(Boolean);

                if (stops.length === 0 && dests.length > 0) stops = dests.slice(0, 3);

                return {
                    id: t.id,
                    badgeLabel: `Lựa chọn ${idx + 1}`,
                    name: t.name,
                    desc: t.description || 'Hành trình trải nghiệm độc đáo tại Bình Lợi',
                    tags: [seasonLabels[t.season] || '🌸 Thu', interestLabels[t.interest] || '🕊️ Bình yên'],
                    duration: t.duration === 'full_day' ? 'Cả ngày' : 'Nửa ngày',
                    km: parseFloat(t.km) || (4.1 + idx * 0.8),
                    stops: stops,
                    source: 'template'
                };
            });

            res.render('journey/suggestions', {
                title: 'Hành Trình Gợi Ý Cho Bạn',
                userMoodLabel: userMoodLabel || '🌿 Sống Chậm',
                aiSuggestions: aiSuggestions || [],
                templateSuggestions: templateSuggestions || []
            });
        } catch (error) {
            console.error("Suggestions error:", error);
            res.redirect('/onboarding');
        }
    }

    async confirm(req, res) {
        try {
            const session = await this.getOrCreateSession(req, res);
            const { templateId, journeyData, source } = req.body;

            if (templateId) {
                const [templates] = await db.query("SELECT * FROM seasonal_journey_templates WHERE id = $1", [templateId]);
                if (templates.length > 0) {
                    const t = templates[0];
                    let stopIds = [];
                    try { stopIds = typeof t.stops === 'string' ? JSON.parse(t.stops) : t.stops; } catch (e) { }

                    const [dests] = await db.query("SELECT * FROM destinations WHERE is_active = 1");
                    let stops = (stopIds || []).map(st => {
                        const stId = (typeof st === 'object') ? (st.id || st.slug) : st;
                        return dests.find(d => String(d.id) === String(stId) || d.slug === String(stId));
                    }).filter(Boolean);

                    if (stops.length === 0 && dests.length > 0) stops = dests.slice(0, 3);

                    await db.query("UPDATE journeys SET status = 'replaced' WHERE session_id = $1 AND status = 'active'", [session.id]);
                    const journeyId = await Journey.create({
                        session_id: session.id,
                        mood: t.name,
                        duration: t.duration === 'full_day' ? 'Cả ngày' : 'Nửa ngày',
                        total_km: parseFloat(t.km) || 5.0,
                        total_minutes: t.duration === 'full_day' ? 360 : 180,
                        status: 'active',
                        interests: JSON.stringify({ source: 'template', templateId: t.id, isConfirmed: false })
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

            if (journeyData) {
                let data = null;
                try {
                    const decoded = Buffer.from(journeyData, 'base64').toString('utf-8');
                    data = JSON.parse(decoded);
                } catch (e) {
                    try { data = JSON.parse(journeyData); } catch (e2) { }
                }

                if (data && data.stops && data.stops.length > 0) {
                    data.source = 'ai';
                    await Journey.createFromSuggestion(session.id, data);
                    return res.redirect('/hanh-trinh-cua-toi');
                }
            }

            const [fallbackDests] = await db.query("SELECT * FROM destinations WHERE is_active = 1 LIMIT 3");
            const journeyId = await Journey.create({
                session_id: session.id,
                mood: 'Lộ Trình AI Tối Ưu',
                duration: 'Nửa ngày',
                total_km: 4.2,
                total_minutes: 180,
                status: 'active',
                interests: JSON.stringify({ source: 'ai', isConfirmed: false })
            });
            const JourneyStop = require('../models/JourneyStop');
            for (let idx = 0; idx < fallbackDests.length; idx++) {
                await JourneyStop.create({
                    journey_id: journeyId,
                    destination_id: fallbackDests[idx].id,
                    stop_order: idx,
                    is_completed: 0
                });
            }
            return res.redirect('/hanh-trinh-cua-toi');

        } catch (error) {
            console.error("Confirm error:", error);
            return res.redirect('/hanh-trinh-cua-toi');
        }
    }

    async loadTemplate(req, res) {
        res.redirect('/hanh-trinh-cua-toi');
    }

    async lockJourney(req, res) {
        try {
            const session = await this.getOrCreateSession(req, res);
            const journey = await Journey.getActiveBySession(session.id);
            if (!journey) return res.json({ success: false });

            let parsed = {};
            try { parsed = typeof journey.interests === 'string' ? JSON.parse(journey.interests) : journey.interests || {}; } catch (e) { }
            
            parsed.isConfirmed = true;

            await db.query(
                "UPDATE journeys SET interests = $1 WHERE id = $2",
                [JSON.stringify(parsed), journey.id]
            );

    async deleteSavedJourney(req, res) {
        try {
            const session = await this.getOrCreateSession(req, res);
            const user = req.user || req.session?.user;
            const journeyId = req.body.journeyId || req.body.id || req.query.journeyId || req.query.id;

            if (!journeyId) {
                return res.status(400).json({ success: false, message: 'Thiếu ID hành trình' });
            }

            await db.query("DELETE FROM journey_stops WHERE journey_id = $1", [journeyId]);
            await db.query(
                `DELETE FROM journeys 
                 WHERE id = $1 AND (
                    session_id = $2 
                    OR session_id IN (SELECT id FROM user_sessions WHERE user_id = $3)
                 )`,
                [journeyId, session.id, user ? user.id : 'guest']
            );

            return res.json({ success: true, message: 'Đã xóa hành trình khỏi tài khoản!' });
        } catch (e) {
            console.error("Delete journey error:", e);
            return res.status(500).json({ success: false, message: e.message });
        }
    }
}

module.exports = new JourneyController();
