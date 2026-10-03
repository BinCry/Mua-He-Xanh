const assert = require('node:assert/strict');
const test = require('node:test');

const db = require('../src/core/database');
const UserSession = require('../src/models/UserSession');
const OnboardingController = require('../src/controllers/OnboardingController');
const ProfileController = require('../src/controllers/ProfileController');

test('onboarding re-submission with an existing session keeps its cleanup queries available', async () => {
    const originalQuery = db.query;
    const originalFindByUuid = UserSession.findByUuid;
    const originalUpdate = UserSession.update;
    const queries = [];
    let responseBody = null;

    db.query = async (sql) => {
        queries.push(sql);
        return [[]];
    };
    UserSession.findByUuid = async () => ({ id: 'session-1' });
    UserSession.update = async () => true;

    const req = {
        body: { mood: 'chill', pax: 'couple', budget: 'mid', duration: 'full_day' },
        cookies: { session_uuid: 'session-uuid' },
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        session: { user: { id: 'user-1' } }
    };
    const res = {
        json(body) {
            responseBody = body;
            return body;
        }
    };

    try {
        await OnboardingController.submit(req, res);
        assert.deepEqual(responseBody, { success: true, redirect: '/journey/suggestions' });
        assert.equal(queries.length, 2);
        assert.match(queries[0], /DELETE FROM journey_stops/i);
        assert.match(queries[1], /DELETE FROM journeys/i);
    } finally {
        db.query = originalQuery;
        UserSession.findByUuid = originalFindByUuid;
        UserSession.update = originalUpdate;
    }
});

test('profile queries use PostgreSQL session columns and do not require a rewards.type column', () => {
    const source = require('node:fs').readFileSync('src/controllers/ProfileController.js', 'utf8');

    assert.match(source, /j\.session_id = us\.id::text OR j\.session_id = us\.uuid/);
    assert.doesNotMatch(source, /j\.session_id = us\.session_uuid/);
    assert.doesNotMatch(source, /r\.type/);
});
