const test = require('node:test');
const assert = require('node:assert/strict');

// This suite is deliberately opt-in. It performs writes only when the caller
// explicitly supplies the isolated audit database URL.
const auditUrl = process.env.TEST_DATABASE_URL;
const canRun = Boolean(auditUrl && /(?:localhost|127\.0\.0\.1).*binh_loi_audit/i.test(auditUrl));

if (!canRun) {
    test('audit database integration suite requires TEST_DATABASE_URL for binh_loi_audit', { skip: true }, () => {});
} else {
    process.env.DATABASE_URL = auditUrl;
    const db = require('../src/core/database');
    const ApiController = require('../src/controllers/ApiController');
    const ReviewController = require('../src/controllers/ReviewController');
    const EventController = require('../src/controllers/EventController');
    const { ensureAuthenticated } = require('../src/middleware/auth');
    const { CommerceIntegrityService, IdempotencyConflictError } = require('../src/services/CommerceIntegrityService');
    const ProductOrderService = require('../src/services/ProductOrderService');
    const WorkshopBookingService = require('../src/services/WorkshopBookingService');
    const { WorkshopManagementService } = require('../src/services/WorkshopManagementService');
    const CommerceTransitionService = require('../src/services/CommerceTransitionService');
    const FestivalTicketService = require('../src/services/FestivalTicketService');
    const Destination = require('../src/models/Destination');

    const ownerId = '00000000-0000-4000-8000-000000000001';
    const otherId = '00000000-0000-4000-8000-000000000002';
    const blockedId = '00000000-0000-4000-8000-000000000003';
    const ownerSession = '00000000-0000-4000-8000-000000000101';
    const otherSession = '00000000-0000-4000-8000-000000000102';
    const journeyId = '00000000-0000-4000-8000-000000000201';
    const destinationId = '00000000-0000-4000-8000-000000000301';
    const inactiveDestinationId = '00000000-0000-4000-8000-000000000302';

    function response() {
        return {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(payload) { this.payload = payload; return payload; },
            send(payload) { this.payload = payload; return payload; },
            render(view, data) { this.view = view; this.data = data; return data; },
            redirect(url) { this.redirectedTo = url; return url; }
        };
    }

    test.before(async () => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id VARCHAR(36) PRIMARY KEY, email TEXT, full_name TEXT, role TEXT,
                role_id INT, is_active INT NOT NULL DEFAULT 1, total_points INT NOT NULL DEFAULT 0
            );
            ALTER TABLE users ADD COLUMN IF NOT EXISTS managed_destination_id VARCHAR(36);
            CREATE TABLE IF NOT EXISTS user_sessions (
                id VARCHAR(36) PRIMARY KEY, uuid VARCHAR(36) UNIQUE NOT NULL, user_id VARCHAR(36),
                mood TEXT, duration TEXT, interests TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS current_mood VARCHAR(50);
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS total_points INT NOT NULL DEFAULT 0;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(50);
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS pax INT NOT NULL DEFAULT 1;
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS budget VARCHAR(50) DEFAULT 'medium';
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS season VARCHAR(50) DEFAULT 'now';
            ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            CREATE TABLE IF NOT EXISTS destinations (
                id VARCHAR(36) PRIMARY KEY, name TEXT, is_active INT NOT NULL DEFAULT 1,
                lat NUMERIC, lng NUMERIC
            );
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS slug VARCHAR(100);
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS description TEXT;
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS short_desc TEXT;
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS type VARCHAR(100) DEFAULT 'nature';
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS moods TEXT DEFAULT '[]';
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS seasons TEXT DEFAULT '[]';
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS cover_image TEXT;
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS gallery TEXT;
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS story TEXT;
            ALTER TABLE destinations ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;
            CREATE TABLE IF NOT EXISTS journeys (
                id VARCHAR(36) PRIMARY KEY, session_id VARCHAR(36) NOT NULL, total_km NUMERIC DEFAULT 0,
                total_minutes INT DEFAULT 0
            );
            ALTER TABLE journeys ADD COLUMN IF NOT EXISTS mood VARCHAR(50);
            ALTER TABLE journeys ADD COLUMN IF NOT EXISTS duration VARCHAR(50);
            ALTER TABLE journeys ADD COLUMN IF NOT EXISTS interests TEXT;
            ALTER TABLE journeys ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
            ALTER TABLE journeys ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            CREATE TABLE IF NOT EXISTS journey_stops (
                id VARCHAR(36) PRIMARY KEY, journey_id VARCHAR(36), destination_id VARCHAR(36),
                stop_order INT, is_completed INT DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS reviews (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36), comments_count INT NOT NULL DEFAULT 0
            );
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS destination_id VARCHAR(36);
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS content TEXT;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS rating INT DEFAULT 5;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS images JSON;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS likes_count INT NOT NULL DEFAULT 0;
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS location_name VARCHAR(300);
            ALTER TABLE reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
            CREATE TABLE IF NOT EXISTS review_comments (
                id VARCHAR(36) PRIMARY KEY, review_id VARCHAR(36), user_id VARCHAR(36), guest_uuid VARCHAR(36),
                parent_id VARCHAR(36), content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS review_likes (
                id VARCHAR(36) PRIMARY KEY, review_id VARCHAR(36) NOT NULL, user_id VARCHAR(36), guest_uuid VARCHAR(36)
            );
            CREATE TABLE IF NOT EXISTS events (
                id VARCHAR(36) PRIMARY KEY, title TEXT, is_active INT NOT NULL DEFAULT 1
            );
            CREATE TABLE IF NOT EXISTS workshops (
                id VARCHAR(36) PRIMARY KEY, title TEXT NOT NULL, destination_id VARCHAR(36),
                is_active INT NOT NULL DEFAULT 1
            );
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS catalog_kind TEXT NOT NULL DEFAULT 'shop';
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
            ALTER TABLE workshops ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
            CREATE TABLE IF NOT EXISTS festivals (
                id VARCHAR(36) PRIMARY KEY, name TEXT NOT NULL, date DATE, status TEXT DEFAULT 'upcoming',
                capacity INT, registration_open BOOLEAN NOT NULL DEFAULT TRUE
            );
            CREATE TABLE IF NOT EXISTS products (
                id VARCHAR(36) PRIMARY KEY, destination_id VARCHAR(36) NOT NULL, title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '', price_vnd BIGINT NOT NULL CHECK (price_vnd >= 0),
                stock_on_hand INT NOT NULL CHECK (stock_on_hand >= 0),
                reserved_stock INT NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0 AND reserved_stock <= stock_on_hand),
                is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS product_orders (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL REFERENCES products(id),
                quantity INT NOT NULL CHECK (quantity > 0), product_title_snapshot TEXT NOT NULL,
                unit_price_vnd BIGINT NOT NULL CHECK (unit_price_vnd >= 0),
                status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
                idempotency_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ, UNIQUE (user_id, idempotency_key)
            );
            CREATE TABLE IF NOT EXISTS workshop_sessions (
                id VARCHAR(36) PRIMARY KEY, workshop_id VARCHAR(36) NOT NULL, starts_at TIMESTAMPTZ NOT NULL,
                ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at), price_vnd BIGINT NOT NULL CHECK (price_vnd >= 0),
                capacity INT NOT NULL CHECK (capacity >= 0), reserved_seats INT NOT NULL DEFAULT 0 CHECK (reserved_seats >= 0 AND reserved_seats <= capacity),
                is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS workshop_session_bookings (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, session_id VARCHAR(36) NOT NULL REFERENCES workshop_sessions(id),
                seats INT NOT NULL CHECK (seats > 0), title_snapshot TEXT NOT NULL, price_vnd_snapshot BIGINT NOT NULL CHECK (price_vnd_snapshot >= 0),
                status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
                idempotency_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ,
                completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ, UNIQUE (user_id, idempotency_key)
            );
            CREATE TABLE IF NOT EXISTS point_ledger (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, delta INT NOT NULL, reason TEXT NOT NULL,
                reference_type TEXT NOT NULL, reference_id VARCHAR(36) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (user_id, reason, reference_type, reference_id)
            );
            CREATE TABLE IF NOT EXISTS idempotency_keys (
                user_id VARCHAR(36) NOT NULL, operation TEXT NOT NULL, key TEXT NOT NULL, payload_hash TEXT NOT NULL,
                response_status INT, response_body JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), committed_at TIMESTAMPTZ,
                PRIMARY KEY (user_id, operation, key)
            );
            CREATE TABLE IF NOT EXISTS festival_tickets (
                id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, festival_id VARCHAR(36) NOT NULL,
                ticket_code TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'used')),
                used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS messages (
                id VARCHAR(36) PRIMARY KEY, sender_id VARCHAR(36), sender_uuid VARCHAR(36), receiver_uuid VARCHAR(36),
                destination_id VARCHAR(36), message TEXT, content TEXT, is_recalled INT NOT NULL DEFAULT 0,
                deleted_for TEXT DEFAULT ''
            );
        `);
        await db.query('TRUNCATE festival_tickets, festivals, workshop_session_bookings, workshop_sessions, workshops, product_orders, products, review_likes, review_comments, reviews, journey_stops, journeys, destinations, user_sessions, users, events, messages, point_ledger, idempotency_keys');
        await db.query(
            `INSERT INTO users (id, email, full_name, role, role_id, is_active) VALUES
             ($1, 'owner@example.test', 'Owner', 'user', 3, 1),
             ($2, 'other@example.test', 'Other', 'user', 3, 1),
             ($3, 'blocked@example.test', 'Blocked', 'user', 3, 0)`,
            [ownerId, otherId, blockedId]
        );
        await db.query(
            `INSERT INTO user_sessions (id, uuid, user_id) VALUES
             ($1, 'owner-session', $2), ($3, 'other-session', $4), ($5, 'blocked-session', $6)`,
            [ownerSession, ownerId, otherSession, otherId, '00000000-0000-4000-8000-000000000103', blockedId]
        );
        await db.query('INSERT INTO destinations (id, name, is_active, lat, lng) VALUES ($1, $2, 1, 10, 106), ($3, $4, 0, 10.1, 106.1)', [destinationId, 'Active', inactiveDestinationId, 'Inactive']);
        await db.query('INSERT INTO journeys (id, session_id) VALUES ($1, $2)', [journeyId, otherSession]);
        await db.query('INSERT INTO journey_stops (id, journey_id, destination_id, stop_order) VALUES ($1, $2, $3, 0)', ['00000000-0000-4000-8000-000000000401', journeyId, destinationId]);
    });

    test.after(async () => db.close());

    test('IDOR: a different account cannot mutate another account journey', async () => {
        const req = { body: { journeyId, action: 'remove', destinationId }, user: { id: ownerId }, session: { user: { id: ownerId } } };
        const res = response();
        await ApiController.updateJourneyStop(req, res);
        assert.equal(res.statusCode, 404);
        const [rows] = await db.query('SELECT id FROM journey_stops WHERE journey_id = $1', [journeyId]);
        assert.equal(rows.length, 1);
    });

    test('a locked account cannot authenticate from an otherwise valid session UUID', async () => {
        const req = { originalUrl: '/api/private', cookies: { session_uuid: 'blocked-session' }, session: {} };
        const res = response();
        let called = false;
        await ensureAuthenticated(req, res, () => { called = true; });
        assert.equal(called, false);
        assert.equal(res.statusCode, 401);
    });

    test('an expired UUID cannot recover an otherwise active account', async () => {
        const expiredUuid = 'expired-owner-session';
        await db.query(
            `INSERT INTO user_sessions (id, uuid, user_id, created_at)
             VALUES ($1, $2, $3, NOW() - INTERVAL '31 days')`,
            ['00000000-0000-4000-8000-000000000104', expiredUuid, ownerId]
        );
        const req = { originalUrl: '/api/private', cookies: { session_uuid: expiredUuid }, session: {} };
        const res = response();
        let called = false;
        await ensureAuthenticated(req, res, () => { called = true; });
        assert.equal(called, false);
        assert.equal(res.statusCode, 401);
    });

    test('a copied session UUID cannot be read or updated from a different cookie session', async () => {
        const otherSessionUuid = 'other-session';
        const writeRes = response();
        await ApiController.session({ method: 'POST', params: { uuid: otherSessionUuid }, cookies: { session_uuid: 'owner-session' }, body: { mood: 'tam_linh' } }, writeRes);
        assert.equal(writeRes.statusCode, 403);
        const readRes = response();
        await ApiController.session({ method: 'GET', params: { uuid: otherSessionUuid }, cookies: { session_uuid: 'owner-session' } }, readRes);
        assert.equal(readRes.statusCode, 403);
        const [rows] = await db.query('SELECT mood FROM user_sessions WHERE uuid = $1', [otherSessionUuid]);
        assert.equal(rows[0].mood, null);
    });

    test('a manager cannot reply to or recall a message outside the assigned destination', async () => {
        const managerId = '00000000-0000-4000-8000-000000000004';
        const managerDestinationId = '00000000-0000-4000-8000-000000000303';
        await db.query('INSERT INTO destinations (id, name, is_active, lat, lng) VALUES ($1, $2, 1, 10.2, 106.2)', [managerDestinationId, 'Manager destination']);
        await db.query(
            'INSERT INTO users (id, email, full_name, role, role_id, is_active, managed_destination_id) VALUES ($1, $2, $3, $4, 2, 1, $5)',
            [managerId, 'manager@example.test', 'Manager', 'manager', managerDestinationId]
        );
        const foreignMessageId = '00000000-0000-4000-8000-000000000801';
        await db.query(
            'INSERT INTO messages (id, sender_id, sender_uuid, destination_id, message, content) VALUES ($1, $2, $3, $4, $5, $5)',
            [foreignMessageId, ownerId, ownerSession, destinationId, 'foreign message']
        );
        const manager = { id: managerId, role: 'manager', role_id: 2, managed_destination_id: managerDestinationId };
        const replyRes = response();
        await ApiController.replyMessage({ body: { messageId: foreignMessageId, replyText: 'not allowed' }, user: manager, session: { user: manager } }, replyRes);
        assert.equal(replyRes.statusCode, 403);
        const recallRes = response();
        await ApiController.recallMessage({ body: { messageId: foreignMessageId, type: 'all' }, user: manager, session: { user: manager }, cookies: {} }, recallRes);
        assert.equal(recallRes.statusCode, 403);
        const [messages] = await db.query('SELECT is_recalled FROM messages WHERE id = $1', [foreignMessageId]);
        assert.equal(Number(messages[0].is_recalled), 0);
    });

    test('comment reply cannot point at a comment belonging to a different review', async () => {
        await db.query('INSERT INTO reviews (id, user_id) VALUES ($1, $2), ($3, $2)', ['00000000-0000-4000-8000-000000000501', ownerId, '00000000-0000-4000-8000-000000000502']);
        await db.query('INSERT INTO review_comments (id, review_id, user_id, content) VALUES ($1, $2, $3, $4)', ['00000000-0000-4000-8000-000000000601', '00000000-0000-4000-8000-000000000502', ownerId, 'foreign parent']);
        const req = { body: { review_id: '00000000-0000-4000-8000-000000000501', parent_id: '00000000-0000-4000-8000-000000000601', comment: 'reply' }, user: { id: ownerId, full_name: 'Owner' }, session: { user: { id: ownerId } } };
        const res = response();
        await ReviewController.comment(req, res);
        assert.equal(res.statusCode, 409);
        const [rows] = await db.query('SELECT comments_count FROM reviews WHERE id = $1', ['00000000-0000-4000-8000-000000000501']);
        assert.equal(Number(rows[0].comments_count), 0);
    });

    test('community likes require an account and preserve exact totals under concurrent requests', async () => {
        const reviewId = '00000000-0000-4000-8000-000000000503';
        await db.query('INSERT INTO reviews (id, user_id) VALUES ($1, $2)', [reviewId, ownerId]);

        const anonymous = response();
        await ReviewController.toggleLike({ body: { review_id: reviewId }, session: {} }, anonymous);
        assert.equal(anonymous.statusCode, 401);
        const [afterAnonymous] = await db.query('SELECT COUNT(*)::int AS count FROM review_likes WHERE review_id = $1', [reviewId]);
        assert.equal(Number(afterAnonymous[0].count), 0);

        const owner = response();
        const other = response();
        await Promise.all([
            ReviewController.toggleLike({ body: { review_id: reviewId }, user: { id: ownerId }, session: { user: { id: ownerId } } }, owner),
            ReviewController.toggleLike({ body: { review_id: reviewId }, user: { id: otherId }, session: { user: { id: otherId } } }, other)
        ]);
        assert.equal(owner.payload.success, true);
        assert.equal(other.payload.success, true);
        const [afterLikes] = await db.query(
            'SELECT r.likes_count, COUNT(l.id)::int AS relation_count FROM reviews r LEFT JOIN review_likes l ON l.review_id = r.id WHERE r.id = $1 GROUP BY r.id',
            [reviewId]
        );
        assert.deepEqual(
            { stored: Number(afterLikes[0].likes_count), relation: Number(afterLikes[0].relation_count) },
            { stored: 2, relation: 2 }
        );

        const unlike = response();
        await ReviewController.toggleLike({ body: { review_id: reviewId }, user: { id: ownerId }, session: { user: { id: ownerId } } }, unlike);
        assert.equal(unlike.payload.liked, false);
        assert.equal(Number(unlike.payload.likes), 1);
        const [finalRows] = await db.query('SELECT likes_count FROM reviews WHERE id = $1', [reviewId]);
        assert.equal(Number(finalRows[0].likes_count), 1);
    });

    test('inactive event is hidden on direct public URL but visible to staff', async () => {
        await db.query('INSERT INTO events (id, title, is_active) VALUES ($1, $2, 0)', ['00000000-0000-4000-8000-000000000701', 'Draft event']);
        const publicRes = response();
        await EventController.show({ params: { id: '00000000-0000-4000-8000-000000000701' }, session: {} }, publicRes);
        assert.equal(publicRes.statusCode, 404);
        const staffRes = response();
        await EventController.show({ params: { id: '00000000-0000-4000-8000-000000000701' }, user: { role: 'admin' }, session: {} }, staffRes);
        assert.equal(staffRes.view, 'events/show');
    });

    test('idempotency replays a committed response and point ledger credits only once', async () => {
        const key = 'audit-idempotency-key';
        const payload = { productId: 'product-1', quantity: 1 };
        const first = await db.transaction(async tx => {
            const begun = await CommerceIntegrityService.begin(tx, ownerId, 'product-order', key, payload);
            assert.equal(begun.replay, false);
            assert.equal(await CommerceIntegrityService.awardPoints(tx, ownerId, 50, 'completion', 'product-order', 'order-1'), true);
            assert.equal(await CommerceIntegrityService.awardPoints(tx, ownerId, 50, 'completion', 'product-order', 'order-1'), false);
            const body = { success: true, orderId: 'order-1' };
            await CommerceIntegrityService.commit(tx, ownerId, 'product-order', key, 201, body);
            return body;
        });
        assert.equal(first.orderId, 'order-1');
        const replay = await db.transaction(tx => CommerceIntegrityService.begin(tx, ownerId, 'product-order', key, payload));
        assert.deepEqual(replay, { replay: true, status: 201, body: { success: true, orderId: 'order-1' } });
        await assert.rejects(
            db.transaction(tx => CommerceIntegrityService.begin(tx, ownerId, 'product-order', key, { productId: 'product-2', quantity: 1 })),
            IdempotencyConflictError
        );
        const [users] = await db.query('SELECT total_points FROM users WHERE id = $1', [ownerId]);
        assert.equal(Number(users[0].total_points), 50);
    });

    test('two concurrent product orders cannot reserve the final unit twice', async () => {
        const productId = '00000000-0000-4000-8000-000000000801';
        await db.query('INSERT INTO products (id, destination_id, title, price_vnd, stock_on_hand) VALUES ($1, $2, $3, $4, $5)', [productId, destinationId, 'Product one', 10000, 1]);
        const outcomes = await Promise.allSettled([
            ProductOrderService.create({ userId: ownerId, productId, quantity: 1, idempotencyKey: 'owner-final-unit' }),
            ProductOrderService.create({ userId: otherId, productId, quantity: 1, idempotencyKey: 'other-final-unit' })
        ]);
        assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
        assert.equal(outcomes.filter(item => item.status === 'rejected' && item.reason.code === 'INSUFFICIENT_STOCK').length, 1);
        const [products] = await db.query('SELECT stock_on_hand, reserved_stock FROM products WHERE id = $1', [productId]);
        assert.deepEqual({ stock: Number(products[0].stock_on_hand), reserved: Number(products[0].reserved_stock) }, { stock: 1, reserved: 1 });
        const [orders] = await db.query('SELECT id FROM product_orders WHERE product_id = $1', [productId]);
        assert.equal(orders.length, 1);
    });

    test('two concurrent workshop bookings cannot reserve the final seat twice', async () => {
        const workshopId = '00000000-0000-4000-8000-000000000901';
        const sessionId = '00000000-0000-4000-8000-000000000902';
        const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const endsAt = new Date(Date.now() + 26 * 60 * 60 * 1000);
        await db.query(
            "INSERT INTO workshops (id, title, destination_id, is_active, catalog_kind) VALUES ($1, $2, $3, 1, 'workshop')",
            [workshopId, 'Workshop one', destinationId]
        );
        await db.query(
            'INSERT INTO workshop_sessions (id, workshop_id, starts_at, ends_at, price_vnd, capacity) VALUES ($1, $2, $3, $4, 150000, 1)',
            [sessionId, workshopId, startsAt, endsAt]
        );
        const outcomes = await Promise.allSettled([
            WorkshopBookingService.create({ userId: ownerId, sessionId, seats: 1, idempotencyKey: 'owner-final-seat' }),
            WorkshopBookingService.create({ userId: otherId, sessionId, seats: 1, idempotencyKey: 'other-final-seat' })
        ]);
        assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
        assert.equal(outcomes.filter(item => item.status === 'rejected' && item.reason.code === 'INSUFFICIENT_WORKSHOP_SEATS').length, 1);
        const [sessions] = await db.query('SELECT capacity, reserved_seats FROM workshop_sessions WHERE id = $1', [sessionId]);
        assert.deepEqual(
            { capacity: Number(sessions[0].capacity), reserved: Number(sessions[0].reserved_seats) },
            { capacity: 1, reserved: 1 }
        );
        const [bookings] = await db.query('SELECT id FROM workshop_session_bookings WHERE session_id = $1', [sessionId]);
        assert.equal(bookings.length, 1);
    });

    test('Workshop management permits rescheduling booked sessions while retaining scope and booking safeguards', async () => {
        const manager = { id: 'manager-workshop-owner', role: 'manager', role_id: 2, managed_destination_id: destinationId };
        const otherManager = { id: 'manager-workshop-other', role: 'manager', role_id: 2, managed_destination_id: inactiveDestinationId };
        const createdWorkshop = await WorkshopManagementService.createWorkshop({
            actor: manager, destinationId: inactiveDestinationId, title: 'Managed workshop', description: 'Scoped',
            idempotencyKey: 'manager-create-workshop-1'
        });
        assert.equal(createdWorkshop.workshop.destinationId, destinationId);
        const startsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        const endsAt = new Date(Date.now() + 50 * 60 * 60 * 1000);
        const createdSession = await WorkshopManagementService.createSession({
            actor: manager, workshopId: createdWorkshop.workshop.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
            priceVnd: 120000, capacity: 2, idempotencyKey: 'manager-create-session-1'
        });
        await assert.rejects(
            WorkshopManagementService.createSession({
                actor: otherManager, workshopId: createdWorkshop.workshop.id, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
                priceVnd: 120000, capacity: 2, idempotencyKey: 'other-manager-create-session-1'
            }),
            error => error.code === 'WORKSHOP_MANAGEMENT_FORBIDDEN'
        );
        const admin = { id: 'admin-workshop', role: 'admin', role_id: 1 };
        const adminEdit = await WorkshopManagementService.updateWorkshop({
            actor: admin, workshopId: createdWorkshop.workshop.id, title: 'Admin revised workshop', description: 'All locations', isActive: true
        });
        assert.equal(adminEdit.workshop.title, 'Admin revised workshop');
        await assert.rejects(
            WorkshopManagementService.updateWorkshop({
                actor: otherManager, workshopId: createdWorkshop.workshop.id, title: 'Forbidden edit', description: '', isActive: true
            }),
            error => error.code === 'WORKSHOP_MANAGEMENT_FORBIDDEN'
        );
        await WorkshopBookingService.create({
            userId: ownerId, sessionId: createdSession.session.id, seats: 1, idempotencyKey: 'managed-session-booking-1'
        });
        const managerRescheduledStart = new Date(startsAt.getTime() + 60 * 60 * 1000);
        const managerRescheduledEnd = new Date(endsAt.getTime() + 60 * 60 * 1000);
        const managerReschedule = await WorkshopManagementService.updateSession({
            actor: manager, sessionId: createdSession.session.id,
            startsAt: managerRescheduledStart.toISOString(), endsAt: managerRescheduledEnd.toISOString(),
            priceVnd: 120000, capacity: 2, isActive: true
        });
        assert.equal(managerReschedule.session.startsAt, managerRescheduledStart.toISOString());
        await assert.rejects(
            WorkshopManagementService.updateSession({
                actor: otherManager, sessionId: createdSession.session.id,
                startsAt: managerRescheduledStart.toISOString(), endsAt: managerRescheduledEnd.toISOString(),
                priceVnd: 120000, capacity: 2, isActive: true
            }),
            error => error.code === 'WORKSHOP_MANAGEMENT_FORBIDDEN'
        );
        await assert.rejects(
            WorkshopManagementService.updateSession({
                actor: { id: ownerId, role: 'user', role_id: 3 }, sessionId: createdSession.session.id,
                startsAt: managerRescheduledStart.toISOString(), endsAt: managerRescheduledEnd.toISOString(),
                priceVnd: 120000, capacity: 2, isActive: true
            }),
            error => error.code === 'WORKSHOP_MANAGEMENT_FORBIDDEN'
        );
        const adminRescheduledStart = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
        const adminRescheduledEnd = new Date(endsAt.getTime() + 2 * 60 * 60 * 1000);
        const adminReschedule = await WorkshopManagementService.updateSession({
            actor: admin, sessionId: createdSession.session.id,
            startsAt: adminRescheduledStart.toISOString(), endsAt: adminRescheduledEnd.toISOString(),
            priceVnd: 120000, capacity: 2, isActive: true
        });
        assert.equal(adminReschedule.session.startsAt, adminRescheduledStart.toISOString());
        await assert.rejects(
            WorkshopManagementService.updateWorkshop({
                actor: manager, workshopId: createdWorkshop.workshop.id, title: 'Cannot close booked workshop', description: '', isActive: false
            }),
            error => error.code === 'WORKSHOP_HAS_OPEN_BOOKINGS'
        );
        await assert.rejects(
            WorkshopManagementService.updateSession({
                actor: manager, sessionId: createdSession.session.id,
                startsAt: adminRescheduledStart.toISOString(), endsAt: adminRescheduledEnd.toISOString(),
                priceVnd: 120000, capacity: 2, isActive: false
            }),
            error => error.code === 'WORKSHOP_SESSION_HAS_OPEN_BOOKINGS'
        );
        await assert.rejects(
            CommerceTransitionService.transitionWorkshop({
                actor: { id: ownerId, role: 'user', role_id: 3 }, bookingId: (await db.query('SELECT id FROM workshop_session_bookings WHERE session_id = $1', [createdSession.session.id]))[0][0].id,
                targetStatus: 'confirmed', idempotencyKey: 'tourist-cannot-confirm-workshop'
            }),
            error => error.code === 'COMMERCE_RECORD_FORBIDDEN'
        );
        const [managedBookings] = await db.query('SELECT id FROM workshop_session_bookings WHERE session_id = $1', [createdSession.session.id]);
        const confirmedBooking = await CommerceTransitionService.transitionWorkshop({
            actor: manager, bookingId: managedBookings[0].id, targetStatus: 'confirmed', idempotencyKey: 'manager-confirms-workshop'
        });
        assert.equal(confirmedBooking.status, 'confirmed');
        await assert.rejects(
            CommerceTransitionService.transitionWorkshop({
                actor: manager, bookingId: managedBookings[0].id, targetStatus: 'completed', idempotencyKey: 'cannot-complete-before-session-ends'
            }),
            error => error.code === 'WORKSHOP_SESSION_NOT_FINISHED'
        );
        const cancelledByTourist = await CommerceTransitionService.transitionWorkshop({
            actor: { id: ownerId, role: 'user', role_id: 3 }, bookingId: managedBookings[0].id,
            targetStatus: 'cancelled', idempotencyKey: 'tourist-cancels-own-workshop'
        });
        assert.equal(cancelledByTourist.status, 'cancelled');
        await assert.rejects(
            WorkshopManagementService.updateSession({
                actor: manager, sessionId: createdSession.session.id, startsAt: adminRescheduledStart.toISOString(), endsAt: adminRescheduledEnd.toISOString(),
                priceVnd: 120000, capacity: 0, isActive: true
            }),
            error => error.code === 'INVALID_WORKSHOP_CAPACITY'
        );
    });

    test('completion and cancellation race leaves one committed product state and an exact point ledger', async () => {
        const productId = '00000000-0000-4000-8000-000000000811';
        await db.query(
            'INSERT INTO products (id, destination_id, title, price_vnd, stock_on_hand) VALUES ($1, $2, $3, $4, $5)',
            [productId, destinationId, 'Race product', 20000, 1]
        );
        const created = await ProductOrderService.create({
            userId: ownerId, productId, quantity: 1, idempotencyKey: 'race-product-create'
        });
        const manager = { id: 'manager-1', role: 'manager', role_id: 2, managed_destination_id: destinationId };
        const confirmed = await CommerceTransitionService.transitionProduct({
            actor: manager, orderId: created.order.id, targetStatus: 'confirmed', idempotencyKey: 'race-product-confirm'
        });
        assert.equal(confirmed.status, 'confirmed');
        const outcomes = await Promise.allSettled([
            CommerceTransitionService.transitionProduct({
                actor: manager, orderId: created.order.id, targetStatus: 'completed', idempotencyKey: 'race-product-complete'
            }),
            CommerceTransitionService.transitionProduct({
                actor: { id: ownerId, role: 'user', role_id: 3 }, orderId: created.order.id, targetStatus: 'cancelled', idempotencyKey: 'race-product-cancel'
            })
        ]);
        assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
        assert.equal(outcomes.filter(item => item.status === 'rejected' && item.reason.code === 'INVALID_STATUS_TRANSITION').length, 1);
        const [orders] = await db.query('SELECT status FROM product_orders WHERE id = $1', [created.order.id]);
        const [products] = await db.query('SELECT stock_on_hand, reserved_stock FROM products WHERE id = $1', [productId]);
        assert.ok(['completed', 'cancelled'].includes(orders[0].status));
        assert.equal(Number(products[0].reserved_stock), 0);
        assert.equal(Number(products[0].stock_on_hand), orders[0].status === 'completed' ? 0 : 1);
        const [ledger] = await db.query(
            'SELECT delta FROM point_ledger WHERE user_id = $1 AND reason = $2 AND reference_id = $3',
            [ownerId, 'completion', created.order.id]
        );
        assert.equal(ledger.length, orders[0].status === 'completed' ? 1 : 0);
    });

    test('festival ticket creation is idempotent and a draft festival cannot issue tickets', async () => {
        const activeFestivalId = '00000000-0000-4000-8000-000000000a01';
        const draftFestivalId = '00000000-0000-4000-8000-000000000a02';
        await db.query(
            'INSERT INTO festivals (id, name, status) VALUES ($1, $2, $3), ($4, $5, $6)',
            [activeFestivalId, 'Festival active', 'upcoming', draftFestivalId, 'Festival draft', 'draft']
        );
        await db.query('UPDATE festivals SET capacity = 2 WHERE id = $1', [activeFestivalId]);
        const first = await FestivalTicketService.create({
            userId: ownerId, festivalId: activeFestivalId, count: 2, idempotencyKey: 'festival-active-create'
        });
        const replay = await FestivalTicketService.create({
            userId: ownerId, festivalId: activeFestivalId, count: 2, idempotencyKey: 'festival-active-create'
        });
        assert.equal(first.tickets.length, 2);
        assert.equal(replay.replay, true);
        assert.deepEqual(replay.tickets, first.tickets);
        const [issued] = await db.query('SELECT ticket_code FROM festival_tickets WHERE festival_id = $1', [activeFestivalId]);
        assert.equal(issued.length, 2);
        await assert.rejects(
            FestivalTicketService.create({
                userId: otherId, festivalId: activeFestivalId, count: 1, idempotencyKey: 'festival-over-capacity'
            }),
            error => error.code === 'FESTIVAL_CAPACITY_FULL'
        );
        const cancelled = await FestivalTicketService.cancel({
            userId: ownerId, ticketId: first.tickets[0].id, idempotencyKey: 'festival-ticket-cancel'
        });
        assert.equal(cancelled.status, 'cancelled');
        await assert.rejects(
            FestivalTicketService.use({
                actor: { id: ownerId, role: 'user', role_id: 3 },
                ticketId: first.tickets[1].id,
                idempotencyKey: 'festival-ticket-user-use'
            }),
            error => error.code === 'FESTIVAL_TICKET_FORBIDDEN'
        );
        const used = await FestivalTicketService.use({
            actor: { id: 'admin-1', role: 'admin', role_id: 1 },
            ticketId: first.tickets[1].id,
            idempotencyKey: 'festival-ticket-admin-use'
        });
        assert.equal(used.status, 'used');
        await assert.rejects(
            FestivalTicketService.cancel({
                userId: ownerId, ticketId: first.tickets[1].id, idempotencyKey: 'festival-ticket-used-cancel'
            }),
            error => error.code === 'FESTIVAL_TICKET_STATE_CONFLICT'
        );
        await db.query('UPDATE festivals SET registration_open = FALSE WHERE id = $1', [activeFestivalId]);
        await assert.rejects(
            FestivalTicketService.create({
                userId: otherId, festivalId: activeFestivalId, count: 1, idempotencyKey: 'festival-registration-closed'
            }),
            error => error.code === 'FESTIVAL_REGISTRATION_CLOSED'
        );
        await assert.rejects(
            FestivalTicketService.create({
                userId: ownerId, festivalId: draftFestivalId, count: 1, idempotencyKey: 'festival-draft-create'
            }),
            error => error.code === 'FESTIVAL_UNAVAILABLE'
        );
    });

    test('two concurrent festival registrations cannot issue the final ticket twice', async () => {
        const festivalId = '00000000-0000-4000-8000-000000000a03';
        await db.query(
            'INSERT INTO festivals (id, name, status, capacity, registration_open) VALUES ($1, $2, $3, $4, TRUE)',
            [festivalId, 'Festival final ticket', 'upcoming', 1]
        );
        const outcomes = await Promise.allSettled([
            FestivalTicketService.create({
                userId: ownerId, festivalId, count: 1, idempotencyKey: 'festival-final-owner'
            }),
            FestivalTicketService.create({
                userId: otherId, festivalId, count: 1, idempotencyKey: 'festival-final-other'
            })
        ]);
        assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
        assert.equal(outcomes.filter(item => item.status === 'rejected' && item.reason.code === 'FESTIVAL_CAPACITY_FULL').length, 1);
        const [tickets] = await db.query('SELECT id FROM festival_tickets WHERE festival_id = $1 AND status = $2', [festivalId, 'active']);
        assert.equal(tickets.length, 1);
    });

    test('typed destination search matches Vietnamese text without diacritics or case sensitivity', async () => {
        const searchableDestinationId = '00000000-0000-4000-8000-000000000b01';
        await db.query('DELETE FROM destinations WHERE id = $1', [searchableDestinationId]);
        await db.query(
            'INSERT INTO destinations (id, name, short_desc, story, type, is_active, sort_order) VALUES ($1, $2, $3, $4, $5, 1, 999)',
            [searchableDestinationId, 'Làng Mai Vàng', 'Không gian mùa xuân', 'Mai vàng Bình Lợi', 'craft']
        );

        const result = await Destination.paginateActive(1, 50, null, null, 'LANG mai vang');
        assert.ok(result.data.some(row => row.id === searchableDestinationId));
    });
}
