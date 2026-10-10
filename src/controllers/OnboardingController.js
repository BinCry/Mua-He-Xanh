const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');
const db = require('../core/database');

class OnboardingController {
    async index(req, res) {
        const preferences = req.cookies?.session_uuid
            ? await UserSession.findByUuid(req.cookies.session_uuid)
            : null;
        res.render('onboarding/index', {
            title: 'Thiết Kế Hành Trình Của Bạn',
            preferences
        });
    }

    async submit(req, res) {
        try {
            const user = req.user || req.session?.user;
            const { mood, pax, budget, duration, date } = req.body;
            let uuid = req.cookies?.session_uuid;

            if (!uuid) {
                uuid = uuidv4();
                res.cookie('session_uuid', uuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
            }

            const validMoods = new Set(['chill', 'peace', 'culture', 'family']);
            const moods = (Array.isArray(mood) ? mood : [mood])
                .filter(value => typeof value === 'string' && validMoods.has(value));
            if (moods.length === 0) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn ít nhất một trải nghiệm.' });
            }
            const moodStr = [...new Set(moods)].join(',');
            let session = await UserSession.findByUuid(uuid);

            let paxVal = 2;
            if (typeof pax === 'number') {
                paxVal = pax;
            } else if (typeof pax === 'string') {
                if (pax === 'solo' || pax === '1') paxVal = 1;
                else if (pax === 'couple' || pax === '2') paxVal = 2;
                else if (pax === 'group' || pax === '3-5') paxVal = 4;
                else if (pax === 'family' || pax === '5+') paxVal = 5;
                else paxVal = parseInt(pax) || 2;
            }

            const sessionData = {
                mood: moodStr,
                pax: paxVal,
                budget: budget || 'mid',
                duration: duration || 'full_day'
            };

            if (session) {
                // If re-submitting onboarding (Làm lại), delete any unconfirmed draft/replaced journeys for this session
                await db.query(`
                    DELETE FROM journey_stops WHERE journey_id IN (
                        SELECT id FROM journeys WHERE session_id = $1 AND (status IN ('replaced', 'abandoned') OR (interests IS NULL OR interests NOT LIKE '%"isConfirmed":true%'))
                    )
                `, [session.id]).catch(() => {});
                await db.query(`
                    DELETE FROM journeys WHERE session_id = $1 AND (status IN ('replaced', 'abandoned') OR (interests IS NULL OR interests NOT LIKE '%"isConfirmed":true%'))
                `, [session.id]).catch(() => {});

                await UserSession.update(session.id, sessionData);
            } else {
                sessionData.uuid = uuid;
                sessionData.user_id = user ? user.id : null;
                await UserSession.create(sessionData);
            }

            const isJson = req.xhr || 
                           (req.headers.accept && req.headers.accept.includes('application/json')) || 
                           (req.headers['content-type'] && req.headers['content-type'].includes('application/json'));

            if (isJson) {
                return res.json({ success: true, redirect: '/journey/suggestions' });
            }
            return res.redirect('/journey/suggestions');
        } catch (e) {
            console.error("Onboarding submit error:", e);
            const isJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
            if (isJson) {
                return res.status(500).json({ success: false, message: 'Không thể lưu tiêu chí hành trình. Vui lòng thử lại.' });
            }
            return res.redirect('/journey/suggestions');
        }
    }
}

module.exports = new OnboardingController();
