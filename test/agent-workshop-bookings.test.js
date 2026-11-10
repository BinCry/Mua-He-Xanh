const assert = require('node:assert/strict');
const test = require('node:test');

const { createAgentServiceAuth } = require('../src/middleware/agentServiceAuth');
const {
    AgentWorkshopBookingQueryService,
    MAX_LIMIT,
    MAX_OFFSET
} = require('../src/services/AgentWorkshopBookingQueryService');
const { createAgentWorkshopBookingController } = require('../src/controllers/AgentWorkshopBookingController');

const SERVICE_TOKEN = 'agent-to-binhloi-test-token-that-is-long-enough';
const REQUEST_ID = '66364422-0f88-4d67-aac0-d7b079877c15';

function response() {
    return {
        statusCode: 200,
        body: null,
        headers: {},
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return body; },
        setHeader(name, value) { this.headers[name] = value; }
    };
}

function request({ headers = {}, query = {} } = {}) {
    const normalizedHeaders = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
    );
    return {
        headers: normalizedHeaders,
        query,
        get(name) { return normalizedHeaders[name.toLowerCase()]; }
    };
}

test('directional service token is required and compared without accepting short or malformed credentials', () => {
    const middleware = createAgentServiceAuth({
        env: { BINHLOI_AGENT_SERVICE_TOKEN: SERVICE_TOKEN }
    });

    for (const authorization of [undefined, 'Basic abc', 'Bearer short', `Bearer ${SERVICE_TOKEN}x`]) {
        const res = response();
        let nextCalls = 0;
        middleware(request({ headers: { authorization } }), res, () => { nextCalls += 1; });
        assert.equal(res.statusCode, 401);
        assert.equal(res.body.code, 'AGENT_SERVICE_UNAUTHORIZED');
        assert.equal(nextCalls, 0);
    }

    const res = response();
    let nextCalls = 0;
    middleware(request({ headers: { authorization: `Bearer ${SERVICE_TOKEN}` } }), res, () => { nextCalls += 1; });
    assert.equal(nextCalls, 1);
    assert.equal(res.body, null);
});

test('missing directional server credential fails closed', () => {
    const res = response();
    createAgentServiceAuth({ env: {} })(request(), res, () => assert.fail('must not call next'));
    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, 'AGENT_SERVICE_NOT_CONFIGURED');
});

test('booking query applies owner and optional reference in SQL before bounded pagination', async () => {
    let captured;
    const database = {
        async query(sql, params) {
            captured = { sql, params };
            return [[{
                bookingId: 'booking-123', status: 'confirmed', seats: '2',
                workshopTitle: 'Lam banh', destinationName: 'Binh Loi',
                startsAt: '2026-12-01T01:00:00.000Z', endsAt: '2026-12-01T03:00:00.000Z',
                email: 'must-not-leak@example.test', price_vnd_snapshot: 999999
            }]];
        }
    };

    const bookings = await AgentWorkshopBookingQueryService.listForPrincipal({
        principalId: 'customer-123',
        bookingReference: 'booking-123',
        limit: '5',
        offset: '10',
        database
    });

    assert.match(captured.sql, /WHERE b\.user_id = \$1 AND b\.id = \$2/);
    assert.match(captured.sql, /LIMIT \$3 OFFSET \$4/);
    assert.deepEqual(captured.params, ['customer-123', 'booking-123', 5, 10]);
    assert.deepEqual(Object.keys(bookings[0]), [
        'bookingId', 'status', 'seats', 'workshopTitle',
        'destinationName', 'startsAt', 'endsAt'
    ]);
    assert.equal(bookings[0].seats, 2);
    assert.doesNotMatch(JSON.stringify(bookings), /email|price_vnd|must-not-leak/i);
});

test('invalid principal, booking reference and pagination are rejected before a database query', async () => {
    let calls = 0;
    const database = { async query() { calls += 1; return [[]]; } };
    const base = { principalId: 'customer-123', database };

    await assert.rejects(
        AgentWorkshopBookingQueryService.listForPrincipal({ ...base, principalId: '../other-user' }),
        error => error.code === 'INVALID_PRINCIPAL_ID'
    );
    await assert.rejects(
        AgentWorkshopBookingQueryService.listForPrincipal({ ...base, bookingReference: 'booking/../../../other' }),
        error => error.code === 'INVALID_BOOKING_REFERENCE'
    );
    await assert.rejects(
        AgentWorkshopBookingQueryService.listForPrincipal({ ...base, limit: String(MAX_LIMIT + 1) }),
        error => error.code === 'INVALID_LIMIT'
    );
    await assert.rejects(
        AgentWorkshopBookingQueryService.listForPrincipal({ ...base, offset: String(MAX_OFFSET + 1) }),
        error => error.code === 'INVALID_OFFSET'
    );
    assert.equal(calls, 0);
});

test('controller trusts authenticated headers, echoes request correlation and returns only the allowlisted envelope', async () => {
    let received;
    const controller = createAgentWorkshopBookingController({
        queryService: {
            async listForPrincipal(value) {
                received = value;
                return [{
                    bookingId: 'booking-123', status: 'pending', seats: 1,
                    workshopTitle: 'Lam banh', destinationName: 'Binh Loi',
                    startsAt: '2026-12-01T01:00:00.000Z', endsAt: '2026-12-01T03:00:00.000Z'
                }];
            }
        }
    });
    const res = response();
    await controller.list(request({
        headers: { 'X-Principal-ID': 'customer-123', 'X-Request-ID': REQUEST_ID },
        query: { bookingReference: 'booking-123', limit: '1', offset: '0' }
    }), res, error => { throw error; });

    assert.deepEqual(received, {
        principalId: 'customer-123', bookingReference: 'booking-123', limit: '1', offset: '0'
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
    assert.equal(res.body.requestId, REQUEST_ID);
    assert.deepEqual(Object.keys(res.body), ['success', 'requestId', 'data']);
});

test('controller accepts the agent safe opaque request-id contract', async () => {
    const controller = createAgentWorkshopBookingController({
        queryService: { async listForPrincipal() { return []; } }
    });
    const res = response();
    await controller.list(request({
        headers: { 'X-Principal-ID': 'customer-123', 'X-Request-ID': 'trace:phase3.1-run_1' }
    }), res, error => { throw error; });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.requestId, 'trace:phase3.1-run_1');
});

test('controller rejects a missing or malformed request id without calling the query service', async () => {
    let calls = 0;
    const controller = createAgentWorkshopBookingController({
        queryService: { async listForPrincipal() { calls += 1; return []; } }
    });

    for (const requestId of [undefined, 'contains spaces', '../escape']) {
        const res = response();
        await controller.list(request({
            headers: { 'X-Principal-ID': 'customer-123', 'X-Request-ID': requestId }
        }), res, error => { throw error; });
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.code, 'INVALID_REQUEST_ID');
    }
    assert.equal(calls, 0);
});
