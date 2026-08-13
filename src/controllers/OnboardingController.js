const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');

class OnboardingController {
    async index(req, res) {
        res.render('onboarding/index', {
            title: 'Thiết Kế Hành Trình Của Bạn'
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

            const moodStr = Array.isArray(mood) ? mood.join(',') : (mood || 'chill');
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
                return res.json({ success: false, redirect: '/journey/suggestions', message: e.message });
            }
            return res.redirect('/journey/suggestions');
        }
    }
}

module.exports = new OnboardingController();
