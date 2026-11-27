const { v4: uuidv4 } = require('uuid');
const { trustedPrincipal } = require('./AgentChatController');
const { createHelpdeskAgentClient } = require('../services/HelpdeskAgentClient');

function createPersonalizationController({ client = createHelpdeskAgentClient() } = {}) {
    async function forward(req, res, method, { key, clear = false, payload } = {}) {
        const principal = trustedPrincipal(req, res);
        if (!principal) return;
        if (['false', '0', 'off'].includes(String(process.env.AI_PERSONALIZATION_ENABLED || '').toLowerCase())) return res.status(404).json({ success: false, code: 'PERSONALIZATION_DISABLED' });
        res.setHeader?.('Cache-Control', 'no-store');
        if (key && !/^[a-z_]{1,64}$/.test(key)) return res.status(400).json({ success: false, code: 'PROFILE_INVALID' });
        try {
            const data = await client.personalization({ method, key, clear, payload, ...principal, requestId: uuidv4() });
            return res.json({ success: true, data });
        } catch (error) {
            const status = error.code === 'PROFILE_CONFLICT' ? 409 : error.code === 'PROFILE_INVALID' ? 400 : 503;
            return res.status(status).json({ success: false, code: status === 503 ? 'PERSONALIZATION_UNAVAILABLE' : error.code });
        }
    }
    return {
        page(req, res) {
            if (['false', '0', 'off'].includes(String(process.env.AI_PERSONALIZATION_ENABLED || '').toLowerCase())) return res.status(404).end();
            res.setHeader('Cache-Control', 'no-store');
            return res.render('profile/personalization', { title: 'Cá nhân hóa', layout: 'layouts/main' });
        },
        get(req, res) { return forward(req, res, 'GET'); },
        settings(req, res) {
            if (typeof req.body?.enabled !== 'boolean') return res.status(400).json({ success: false, code: 'PROFILE_INVALID' });
            return forward(req, res, 'PATCH', { payload: { enabled: req.body.enabled } });
        },
        edit(req, res) {
            if (!req.body || !Object.hasOwn(req.body, 'value')) return res.status(400).json({ success: false, code: 'PROFILE_INVALID' });
            return forward(req, res, 'PATCH', { key: req.params.key, payload: { value: req.body.value } });
        },
        remove(req, res) { return forward(req, res, 'DELETE', { key: req.params.key }); },
        clear(req, res) { return forward(req, res, 'DELETE', { clear: true }); }
    };
}
module.exports = { ...createPersonalizationController(), createPersonalizationController };
