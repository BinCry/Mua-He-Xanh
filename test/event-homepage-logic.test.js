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

function eventDate(offsetMs) {
    return new Date(Date.now() + offsetMs).toISOString();
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

test('an active future event that is not featured appears only in the upcoming schedule', async () => {
    const regularEvent = { id: 'regular', title: 'Lịch thường', is_featured: 0, event_date: eventDate(3600000) };
    const rendered = await renderHome([regularEvent]);

    assert.equal(rendered.view, 'home/index');
    assert.deepEqual(rendered.data.featuredEvents, []);
    assert.deepEqual(rendered.data.upcomingEvents, [regularEvent]);
});

test('an active future featured event appears in both the featured scroller and upcoming schedule', async () => {
    const firstFeatured = { id: 'featured-1', title: 'Nổi bật 1', is_featured: 1, event_date: eventDate(3600000) };
    const secondFeatured = { id: 'featured-2', title: 'Nổi bật 2', is_featured: true, event_date: eventDate(7200000) };
    const regularEvent = { id: 'regular', title: 'Lịch thường', is_featured: 0, event_date: eventDate(10800000) };
    const rendered = await renderHome([firstFeatured, secondFeatured, regularEvent]);

    assert.deepEqual(rendered.data.featuredEvents, [firstFeatured, secondFeatured]);
    assert.deepEqual(rendered.data.upcomingEvents, [firstFeatured, secondFeatured, regularEvent]);
});

test('past events are excluded from upcoming, but active featured past events stay featured', async () => {
    const pastFeatured = { id: 'past-featured', title: 'Nổi bật đã qua', is_featured: 1, event_date: eventDate(-3600000) };
    const pastRegular = { id: 'past-regular', title: 'Thường đã qua', is_featured: 0, event_date: eventDate(-7200000) };
    const invalidDate = { id: 'invalid-date', title: 'Ngày lỗi', is_featured: 0, event_date: 'không phải ngày' };
    const rendered = await renderHome([pastFeatured, pastRegular, invalidDate]);

    assert.deepEqual(rendered.data.featuredEvents, [pastFeatured]);
    assert.deepEqual(rendered.data.upcomingEvents, []);
});

test('homepage source queries only active events', () => {
    const controller = fs.readFileSync('src/controllers/HomeController.js', 'utf8');
    assert.match(controller, /SELECT \* FROM events WHERE is_active = 1 ORDER BY event_date ASC/);
});

test('event mutations preserve active and featured switches while disabling the retired countdown field', async () => {
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
            title: '  Cờ chuẩn hóa  ', event_date: eventDate(3600000), is_featured: 'false', is_countdown: 'true', is_active: '1'
        } }, createResponse);
        const insert = calls.find(call => call.sql.includes('INSERT INTO events'));
        assert.equal(createResponse.payload.success, true);
        assert.deepEqual(insert.params.slice(-3), [0, 0, 1]);
        assert.equal(insert.params[1], 'Cờ chuẩn hóa');
        assert.ok(!calls.some(call => call.sql.includes('pg_advisory_xact_lock')));

        const updateResponse = response();
        await AdminController.updateEvent({ body: {
            id: 'event-1', title: 'Tắt nổi bật', event_date: eventDate(7200000), is_featured: 'false', is_countdown: 'true', is_active: 'false'
        } }, updateResponse);
        const update = calls.find(call => call.sql.startsWith('UPDATE events SET title'));
        assert.equal(updateResponse.payload.success, true);
        assert.deepEqual(update.params.slice(-4), [0, 0, 0, 'event-1']);

        db.transaction = async (work) => work({
            async query() {
                return [Object.assign([], { rowCount: 0 }), []];
            }
        });
        const missingResponse = response();
        await AdminController.updateEvent({ body: {
            id: 'missing-event', title: 'Không tồn tại', event_date: eventDate(7200000), is_active: true
        } }, missingResponse);
        assert.equal(missingResponse.statusCode, 404);
        assert.match(missingResponse.payload.message, /Không tìm thấy/);
    } finally {
        db.transaction = originalTransaction;
    }
});

test('event views keep the featured scroller, use automatic upcoming countdowns, and remove countdown admin controls', () => {
    const home = fs.readFileSync('src/views/home/index.ejs', 'utf8');
    const admin = fs.readFileSync('src/views/admin/events.ejs', 'utf8');
    const detail = fs.readFileSync('src/views/events/show.ejs', 'utf8');

    assert.match(home, /featuredEvents\.forEach/);
    assert.match(home, /upcomingEvents\.forEach/);
    assert.match(home, /upcoming-events-card/);
    assert.match(home, /scrollable-events-container h-100 overflow-auto/);
    assert.match(home, /index === 0/);
    assert.match(home, /ms-auto text-center/);
    assert.match(home, /data-auto-countdown-date/);
    assert.match(home, /data-auto-countdown-days/);
    assert.match(home, /scroll-snap-type: x mandatory/);
    assert.match(home, /object-fit: cover; object-position: center; z-index: 2/);
    assert.doesNotMatch(home, /data-countdown-date|Vuốt hoặc cuộn ngang|Lịch sự kiện sắp diễn ra|otherEvents/);
    assert.doesNotMatch(admin, /evt_is_countdown|Hiện Countdown|<th>Countdown<\/th>/);
    assert.doesNotMatch(detail, /Đang đếm ngược/);
    assert.match(detail, /aspect-ratio: 16 \/ 9; background: #0f172a/);
    assert.match(detail, /object-fit: cover; object-position: center/);
});
