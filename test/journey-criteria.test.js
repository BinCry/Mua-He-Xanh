const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/core/database');
const UserSession = require('../src/models/UserSession');
const OnboardingController = require('../src/controllers/OnboardingController');
const JourneyController = require('../src/controllers/JourneyController');

function response() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return payload; },
        redirect(url) { this.redirectedTo = url; return url; },
        render(view, payload) { this.view = view; this.payload = payload; return payload; }
    };
}

test('changing moods replaces journey criteria and never falls back to a previous mood route', async () => {
    const originals = {
        query: db.query,
        findByUuid: UserSession.findByUuid,
        update: UserSession.update
    };
    const session = { id: 'session-criteria', uuid: 'criteria-uuid', mood: 'culture', duration: 'full_day' };
    const updates = [];
    const destinations = [
        { id: 'culture-1', name: 'Làng nghề', moods: JSON.stringify(['culture']), lat: 10, lng: 106, sort_order: 1 },
        { id: 'chill-1', name: 'Vườn yên', moods: JSON.stringify(['chill']), lat: 10.1, lng: 106.1, sort_order: 1 }
    ];

    db.query = async (sql) => {
        if (/SELECT \* FROM destinations WHERE is_active = 1/.test(sql)) return [destinations];
        if (/seasonal_journey_templates/.test(sql)) return [[]];
        return [[]];
    };
    UserSession.findByUuid = async () => session;
    UserSession.update = async (id, data) => {
        updates.push({ id, data });
        Object.assign(session, data);
        return true;
    };

    try {
        const firstSubmit = response();
        await OnboardingController.submit({
            body: { mood: ['culture'], pax: 'couple', budget: 'mid', duration: 'full_day' },
            cookies: { session_uuid: 'criteria-uuid' },
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            session: { user: { id: 'user-criteria' } }
        }, firstSubmit);
        assert.equal(firstSubmit.payload.success, true);
        assert.equal(updates.at(-1).data.mood, 'culture');

        const cultureSuggestions = response();
        await JourneyController.suggestions({ cookies: { session_uuid: 'criteria-uuid' }, session: { user: { id: 'user-criteria' } }, query: {} }, cultureSuggestions);
        assert.deepEqual(cultureSuggestions.payload.aiSuggestions[0].stops.map(stop => stop.id), ['culture-1']);

        const secondSubmit = response();
        await OnboardingController.submit({
            body: { mood: ['peace'], pax: 'couple', budget: 'mid', duration: 'full_day' },
            cookies: { session_uuid: 'criteria-uuid' },
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            session: { user: { id: 'user-criteria' } }
        }, secondSubmit);
        assert.equal(updates.at(-1).data.mood, 'peace');

        const noMatchSuggestions = response();
        await JourneyController.suggestions({ cookies: { session_uuid: 'criteria-uuid' }, session: { user: { id: 'user-criteria' } }, query: {} }, noMatchSuggestions);
        assert.deepEqual(noMatchSuggestions.payload.aiSuggestions, []);
        assert.deepEqual(noMatchSuggestions.payload.templateSuggestions, []);
        assert.equal(noMatchSuggestions.payload.userMoodLabel, '🛕 Tâm Linh');

        Object.assign(session, { mood: null });
        const missingCriteria = response();
        await JourneyController.suggestions({ cookies: { session_uuid: 'criteria-uuid' }, session: { user: { id: 'user-criteria' } }, query: {} }, missingCriteria);
        assert.equal(missingCriteria.redirectedTo, '/onboarding?error=criteria_required');
    } finally {
        db.query = originals.query;
        UserSession.findByUuid = originals.findByUuid;
        UserSession.update = originals.update;
    }
});
