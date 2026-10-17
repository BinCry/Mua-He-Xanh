const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/core/database');
const JourneyController = require('../src/controllers/JourneyController');
const Journey = require('../src/models/Journey');
const ApiController = require('../src/controllers/ApiController');
const AdminController = require('../src/controllers/AdminController');

function response() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        render(view, payload) { this.view = view; this.payload = payload; return payload; }
    };
}

test('journey catalogue lists every visible administrator-managed tour without onboarding criteria', async () => {
    const originalQuery = db.query;
    const templates = [
        { id: 'tour-culture', name: 'Tour văn hóa', description: 'Khám phá làng nghề', season: 'summer', interest: 'culture', duration: 'full_day', km: 5.2, stops: JSON.stringify(['dest-culture']) },
        { id: 'tour-peace', name: 'Tour bình yên', description: 'Không gian xanh', season: 'winter', interest: 'peace', duration: 'half_day', km: 2.4, stops: JSON.stringify(['dest-peace']) },
        { id: 'tour-hidden', name: 'Tour đã ẩn', description: '', season: 'winter', interest: 'peace', duration: 'half_day', km: 2.4, stops: JSON.stringify(['dest-peace']), is_active: 0 }
    ];
    const destinations = [
        { id: 'dest-culture', name: 'Làng nghề', slug: 'lang-nghe', cover_image: '/culture.jpg' },
        { id: 'dest-peace', name: 'Vườn yên', slug: 'vuon-yen', cover_image: '/peace.jpg' }
    ];
    db.query = async (sql) => {
        if (/seasonal_journey_templates/.test(sql)) {
            assert.match(sql, /WHERE is_active = 1/);
            return [templates.filter(template => template.is_active !== 0)];
        }
        return [destinations];
    };

    try {
        const res = response();
        await JourneyController.tours({}, res);
        assert.equal(res.view, 'journey/tours');
        assert.equal(res.payload.tours.length, 2);
        assert.deepEqual(res.payload.tours.map(tour => tour.id), ['tour-culture', 'tour-peace']);
        assert.equal(res.payload.tours[0].stops[0].name, 'Làng nghề');
    } finally {
        db.query = originalQuery;
    }
});

test('an administrator can atomically hide or show a journey template', async () => {
    const originalQuery = db.query;
    let captured;
    db.query = async (sql, params) => {
        captured = { sql, params };
        return [[{ is_active: 0 }]];
    };
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return payload; }
    };

    try {
        await AdminController.toggleJourneyTemplate({ body: { id: 'tour-1' } }, res);
        assert.match(captured.sql, /SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END/);
        assert.deepEqual(captured.params, ['tour-1']);
        assert.equal(res.payload.success, true);
        assert.equal(res.payload.is_active, false);
    } finally {
        db.query = originalQuery;
    }
});

test('tour detail preserves configured stop order and excludes inactive destinations', async () => {
    const originalQuery = db.query;
    const template = { id: 'tour-1', name: 'Tour mẫu', description: '', duration: 'half_day', km: 0, stops: JSON.stringify(['visible-2', 'hidden', 'visible-1']) };
    const destinations = [
        { id: 'visible-1', name: 'Điểm một', slug: 'mot' },
        { id: 'visible-2', name: 'Điểm hai', slug: 'hai' }
    ];
    db.query = async (sql) => /WHERE id = \$1/.test(sql) ? [[template]] : [destinations];

    try {
        const res = response();
        await JourneyController.tourDetail({ params: { id: 'tour-1' } }, res);
        assert.equal(res.view, 'journey/tour_detail');
        assert.deepEqual(res.payload.tour.stops.map(stop => stop.id), ['visible-2', 'visible-1']);
    } finally {
        db.query = originalQuery;
    }
});

test('a confirmed itinerary remains readable but cannot be edited through the draft endpoint', async () => {
    const originalQuery = Journey.db.query;
    let currentQuery = null;
    Journey.db.query = async (sql, params) => {
        currentQuery = { sql, params };
        return [[{ id: 'confirmed-journey', status: 'confirmed' }]];
    };

    try {
        const journey = await Journey.getCurrentBySession('session-1');
        assert.equal(journey.id, 'confirmed-journey');
        assert.match(currentQuery.sql, /status IN \('active', 'confirmed'\)/);
    } finally {
        Journey.db.query = originalQuery;
    }

    const originalTransaction = db.transaction;
    db.transaction = async callback => callback({
        query: async sql => /SELECT j\.id, j\.status/.test(sql) ? [[{ id: 'confirmed-journey', status: 'confirmed' }]] : [[]]
    });
    const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return payload; }
    };
    try {
        await ApiController.updateJourneyStop({
            body: { journeyId: 'confirmed-journey', action: 'remove', destinationId: 'stop-1' },
            user: { id: 'user-1' }
        }, res);
        assert.equal(res.statusCode, 409);
        assert.equal(res.payload.success, false);
    } finally {
        db.transaction = originalTransaction;
    }
});
