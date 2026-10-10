const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');
const Destination = require('../models/Destination');
const Model = require('../core/Model');
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { setSessionUuidCookie } = require('../utils/sessionCookie');

function estimateStraightLineKm(stops) {
    if (!Array.isArray(stops) || stops.length < 2) return null;

    let totalMeters = 0;
    for (let index = 1; index < stops.length; index++) {
        const previous = stops[index - 1];
        const current = stops[index];
        if ([previous?.lat, previous?.lng, current?.lat, current?.lng]
            .some(value => value === null || value === undefined || value === '')) return null;
        const previousLat = Number(previous?.lat);
        const previousLng = Number(previous?.lng);
        const currentLat = Number(current?.lat);
        const currentLng = Number(current?.lng);
        if (![previousLat, previousLng, currentLat, currentLng].every(Number.isFinite)
            || Math.abs(previousLat) > 90 || Math.abs(currentLat) > 90
            || Math.abs(previousLng) > 180 || Math.abs(currentLng) > 180) {
            return null;
        }
        totalMeters += Model.haversine(previousLat, previousLng, currentLat, currentLng);
    }

    return Math.round((totalMeters / 1000) * 100) / 100;
}

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
            setSessionUuidCookie(res, uuid);
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

            if (!journey) return res.redirect('/journey/suggestions');

            let journeyWithStops = await Journey.getWithStops(journey.id);
            if (!journeyWithStops || !journeyWithStops.stops || journeyWithStops.stops.length === 0) {
                return res.redirect('/journey/suggestions');
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

            const matchesMood = (destination) => {
                let moods = [];
                try { moods = Array.isArray(destination.moods) ? destination.moods : JSON.parse(destination.moods); }
                catch (_) { moods = String(destination.moods || '').split(','); }
                return moods.map(String).map(value => value.trim()).filter(value => userMoodKeys.includes(value)).length;
            };
            const matchingDestinations = dests.filter(destination => matchesMood(destination) > 0)
                .sort((a, b) => matchesMood(b) - matchesMood(a) || (a.sort_order || 0) - (b.sort_order || 0));
            const maxStops = session.duration === 'half_day' ? 2 : 3;
            let aiSuggestions = [];
            try {
                const candidates = matchingDestinations.length ? matchingDestinations : dests;
                let sortedStops = candidates.slice(0, maxStops);

                const totalKm = estimateStraightLineKm(sortedStops);

                aiSuggestions.push({
                    id: 'personalized-suggestion-1',
                    name: 'Gợi ý hành trình theo sở thích',
                    desc: `Chọn tối đa ${maxStops} điểm theo sở thích và thứ tự ưu tiên hiện có. Khoảng cách, nếu có, là ước tính đường chim bay chứ chưa phải chỉ đường đường bộ.`,
                    tags: ['Theo sở thích', 'Theo thứ tự gợi ý'],
                    duration: session.duration === 'half_day' ? 'Nửa ngày' : 'Trọn 1 ngày',
                    km: totalKm,
                    stops: sortedStops,
                    source: 'personalized'
                });
            } catch (e) { }

            const [templates] = await db.query("SELECT * FROM seasonal_journey_templates ORDER BY created_at DESC");
            const seasonLabels = { spring: '🌸 Xuân', summer: '☀️ Hạ', autumn: '🍂 Thu', winter: '❄️ Đông' };
            const interestLabels = { chill: '🕊️ Bình yên', peace: '🛕 Thư giãn', culture: '🎨 Văn hóa', family: '👨‍👩‍👧‍👦 Gắn kết' };

            let templateSuggestions = templates.filter(t => userMoodKeys.includes(t.interest)).map((t, idx) => {
                let stopIds = [];
                try { stopIds = typeof t.stops === 'string' ? JSON.parse(t.stops) : t.stops; } catch (e) { }

                let stops = (stopIds || []).map(st => {
                    const stId = (typeof st === 'object') ? (st.id || st.slug) : st;
                    return dests.find(d => String(d.id) === String(stId) || d.slug === String(stId));
                }).filter(Boolean);

                if (stops.length === 0) return null;

                return {
                    id: t.id,
                    badgeLabel: `Lựa chọn ${idx + 1}`,
                    name: t.name,
                    desc: t.description || 'Hành trình trải nghiệm độc đáo tại Bình Lợi',
                    tags: [seasonLabels[t.season] || '🌸 Thu', interestLabels[t.interest] || '🕊️ Bình yên'],
                    duration: t.duration === 'full_day' ? 'Cả ngày' : 'Nửa ngày',
                    km: estimateStraightLineKm(stops),
                    stops: stops,
                    source: 'template'
                };
            }).filter(Boolean);

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
            const { templateId, journeyData } = req.body;

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

                    if (stops.length === 0) return res.redirect('/journey/suggestions');

                    await db.query(`
                        DELETE FROM journey_stops WHERE journey_id IN (
                            SELECT id FROM journeys WHERE session_id = $1 AND (status IN ('replaced', 'abandoned') OR (interests IS NULL OR interests NOT LIKE '%"isConfirmed":true%'))
                        )
                    `, [session.id]).catch(() => {});
                    await db.query(`
                        DELETE FROM journeys WHERE session_id = $1 AND (status IN ('replaced', 'abandoned') OR (interests IS NULL OR interests NOT LIKE '%"isConfirmed":true%'))
                    `, [session.id]).catch(() => {});

                    const journeyId = await Journey.create({
                        session_id: session.id,
                        mood: t.name,
                        duration: t.duration === 'full_day' ? 'Cả ngày' : 'Nửa ngày',
                        total_km: 0,
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

                if (data && Array.isArray(data.stops) && data.stops.length > 0) {
                    data.source = 'personalized';
                    const journeyId = await Journey.createFromSuggestion(session.id, data);
                    if (journeyId) return res.redirect('/hanh-trinh-cua-toi');
                }
            }
            return res.redirect('/journey/suggestions');

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
                "UPDATE journeys SET status = 'confirmed', interests = $1 WHERE id = $2",
                [JSON.stringify(parsed), journey.id]
            );

            return res.json({ success: true });
        } catch (e) {
            return res.json({ success: false, error: e.message });
        }
    }

    async deleteSavedJourney(req, res) {
        let client;
        try {
            const session = await this.getOrCreateSession(req, res);
            const user = req.user || req.session?.user;
            const journeyId = req.body.journeyId || req.body.id || req.query.journeyId || req.query.id;

            if (!journeyId) {
                return res.status(400).json({ success: false, message: 'Thiếu ID hành trình' });
            }

            client = await db.pgPool.connect();
            await client.query('BEGIN');
            const ownedJourney = await client.query(
                `SELECT id FROM journeys
                 WHERE id = $1 AND (
                    session_id = $2::text
                    OR session_id IN (SELECT id::text FROM user_sessions WHERE user_id = $3)
                    OR session_id IN (SELECT uuid FROM user_sessions WHERE user_id = $3)
                 )
                 FOR UPDATE`,
                [journeyId, session.id, user ? user.id : 'guest']
            );
            if (ownedJourney.rowCount !== 1) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Không tìm thấy hành trình thuộc tài khoản của bạn.' });
            }
            await client.query('DELETE FROM journey_stops WHERE journey_id = $1', [journeyId]);
            await client.query('DELETE FROM journeys WHERE id = $1', [journeyId]);
            await client.query('COMMIT');

            return res.json({ success: true, message: 'Đã xóa hành trình khỏi tài khoản!' });
        } catch (e) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error("Delete journey error:", e);
            return res.status(500).json({ success: false, message: e.message });
        } finally {
            client?.release();
        }
    }
}

module.exports = new JourneyController();
