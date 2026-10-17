const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const db = require('../src/core/database');
const HomeController = require('../src/controllers/HomeController');
const AdminController = require('../src/controllers/AdminController');

function response() {
    return {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
        }
    };
}

async function renderHome(events) {
    const originalQuery = db.query;
    const originalEnvironment = process.env.NODE_ENV;
    const rendered = {};
    process.env.NODE_ENV = 'test';
    HomeController.clearCache();
    db.query = async (sql) => {
        if (sql.includes('FROM events WHERE is_active = 1')) return [events, []];
        if (sql.includes('COUNT(*) as total FROM analytics') || sql.includes('COUNT(DISTINCT session_id)')) return [[{ total: 0 }], []];
        if (sql.includes('COUNT(*) as total FROM workshops')) return [[{ total: 0 }], []];
        if (sql.includes('AVG(rating) as avg')) return [[{ avg: null, count: 0 }], []];
        return [[], []];
    };
    try {
        await HomeController.index({}, {
            locals: { settings: {} },
            render(view, data) {
                rendered.view = view;
                rendered.data = data;
            }
        });
        return rendered;
    } finally {
        db.query = originalQuery;
        process.env.NODE_ENV = originalEnvironment;
        HomeController.clearCache();
    }
}

test('homepage only promotes featured events and keeps ordinary active events in the schedule', async () => {
    const regularEvent = { id: 'regular', title: 'Lịch thường', is_featured: 0, is_countdown: 0, event_date: '2026-10-20T08:00:00Z' };
    const rendered = await renderHome([regularEvent]);

    assert.equal(rendered.view, 'home/index');
    assert.deepEqual(rendered.data.featuredEvents, []);
    assert.equal(rendered.data.countdownEvent, null);
    assert.deepEqual(rendered.data.otherEvents, [regularEvent]);
});

test('homepage exposes every featured event for the featured scroller and does not duplicate them in the schedule', async () => {
    const firstFeatured = { id: 'featured-1', title: 'Nổi bật 1', is_featured: 1, is_countdown: 0, event_date: '2026-10-20T08:00:00Z' };
    const secondFeatured = { id: 'featured-2', title: 'Nổi bật 2', is_featured: true, is_countdown: 0, event_date: '2026-10-21T08:00:00Z' };
    const regularEvent = { id: 'regular', title: 'Lịch thường', is_featured: 0, is_countdown: 0, event_date: '2026-10-22T08:00:00Z' };
    const rendered = await renderHome([firstFeatured, secondFeatured, regularEvent]);

    assert.deepEqual(rendered.data.featuredEvents, [firstFeatured, secondFeatured]);
    assert.deepEqual(rendered.data.otherEvents, [regularEvent]);
});

test('homepage countdown is selected independently from featured events', async () => {
    const featuredEvent = { id: 'featured', title: 'Nổi bật', is_featured: 1, is_countdown: 0, event_date: '2026-10-20T08:00:00Z' };
    const countdownEvent = { id: 'countdown', title: 'Đếm ngược', is_featured: 0, is_countdown: 1, event_date: '2026-10-21T08:00:00Z' };
    const rendered = await renderHome([featuredEvent, countdownEvent]);

    assert.deepEqual(rendered.data.featuredEvents, [featuredEvent]);
    assert.deepEqual(rendered.data.countdownEvent, countdownEvent);
});

test('homepage never renders a countdown for an event that has already started', async () => {
    const pastCountdown = { id: 'past-countdown', title: 'Đã bắt đầu', is_featured: 0, is_countdown: 1, event_date: '2020-01-01T08:00:00Z' };
    const rendered = await renderHome([pastCountdown]);

    assert.equal(rendered.data.countdownEvent, null);
    assert.deepEqual(rendered.data.otherEvents, [pastCountdown]);
});

test('event mutations normalize switch values and reject an inactive countdown', async () => {
    const inactiveCountdownResponse = response();
    await AdminController.createEvent({ body: {
        title: 'Không hợp lệ', event_date: '2026-10-21T08:00', is_countdown: 'true', is_active: 'false'
    } }, inactiveCountdownResponse);
    assert.equal(inactiveCountdownResponse.statusCode, 400);
    assert.match(inactiveCountdownResponse.payload.message, /Countdown/);

    const originalTransaction = db.transaction;
    const calls = [];
    db.transaction = async (work) => work({
        async query(sql, params = []) {
            calls.push({ sql, params });
            return [Object.assign([], { rowCount: 1 }), []];
        }
    });
    try {
        const createResponse = response();
        await AdminController.createEvent({ body: {
            title: '  Cờ chuẩn hóa  ', event_date: '2026-10-21T08:00', is_featured: 'false', is_countdown: '0', is_active: '1'
        } }, createResponse);
        const insert = calls.find(call => call.sql.includes('INSERT INTO events'));
        assert.equal(createResponse.payload.success, true);
        assert.deepEqual(insert.params.slice(-3), [0, 0, 1]);
        assert.equal(insert.params[1], 'Cờ chuẩn hóa');

        const countdownResponse = response();
        await AdminController.createEvent({ body: {
            title: 'Countdown hợp lệ', event_date: '2026-10-21T08:00', is_countdown: true, is_active: true
        } }, countdownResponse);
        assert.equal(countdownResponse.payload.success, true);
        assert.ok(calls.some(call => call.sql.includes('pg_advisory_xact_lock')));

        const updateResponse = response();
        await AdminController.updateEvent({ body: {
            id: 'event-1', title: 'Tắt nổi bật', event_date: '2026-10-21T08:00', is_featured: 'false', is_countdown: '0', is_active: 'true'
        } }, updateResponse);
        const update = calls.find(call => call.sql.startsWith('UPDATE events SET title'));
        assert.equal(updateResponse.payload.success, true);
        assert.deepEqual(update.params.slice(-4), [0, 0, 1, 'event-1']);

        db.transaction = async (work) => work({
            async query() {
                return [Object.assign([], { rowCount: 0 }), []];
            }
        });
        const missingResponse = response();
        await AdminController.updateEvent({ body: {
            id: 'missing-event', title: 'Không tồn tại', event_date: '2026-10-21T08:00', is_active: true
        } }, missingResponse);
        assert.equal(missingResponse.statusCode, 404);
        assert.match(missingResponse.payload.message, /Không tìm thấy/);
    } finally {
        db.transaction = originalTransaction;
    }
});

test('event homepage view contains a featured-event scroller and a dedicated countdown target', () => {
    const home = fs.readFileSync('src/views/home/index.ejs', 'utf8');
    assert.match(home, /featuredEvents\.forEach/);
    assert.match(home, /scroll-snap-type: x mandatory/);
    assert.match(home, /data-countdown-date/);
    assert.match(home, /data-countdown-days/);
    assert.doesNotMatch(home, /nextEvent/);
});
