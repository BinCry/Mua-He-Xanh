const test = require('node:test');
const assert = require('node:assert/strict');

const ApiController = require('../src/controllers/ApiController');
const UserSession = require('../src/models/UserSession');
const Destination = require('../src/models/Destination');
const CheckIn = require('../src/models/CheckIn');
const Journey = require('../src/models/Journey');
const UserBadge = require('../src/models/UserBadge');
const Model = require('../src/core/Model');

test('adding session points also updates the linked user account', async () => {
    const originalDb = UserSession.db;
    let query = null;
    let params = null;

    UserSession.db = {
        async query(sql, values) {
            query = sql;
            params = values;
            return [[{ session_updated: true }]];
        }
    };

    try {
        const updated = await UserSession.addPoints('session-1', 20);

        assert.equal(updated, true);
        assert.deepEqual(params, [20, 'session-1']);
        assert.match(query, /UPDATE\s+user_sessions/i);
        assert.match(query, /UPDATE\s+users/i);
    } finally {
        UserSession.db = originalDb;
    }
});

test('check-in stores the authenticated user id with the visit', async () => {
    const originals = {
        findByUuid: UserSession.findByUuid,
        addPoints: UserSession.addPoints,
        findBySlug: Destination.findBySlug,
        existsForStop: CheckIn.existsForStop,
        create: CheckIn.create,
        getActiveBySession: Journey.getActiveBySession,
        checkAndUnlock: UserBadge.checkAndUnlock,
        haversine: Model.haversine
    };
    let createdCheckin = null;
    let responseBody = null;

    UserSession.findByUuid = async () => ({ id: 'session-1', user_id: 'user-1' });
    UserSession.addPoints = async () => true;
    Destination.findBySlug = async () => ({
        id: 'destination-1',
        name: 'Điểm thử nghiệm',
        points: 20,
        lat: 10,
        lng: 106,
        radius_meter: 100
    });
    Model.haversine = () => 5000;
    CheckIn.existsForStop = async () => false;
    CheckIn.create = async data => {
        createdCheckin = data;
        return 'checkin-1';
    };
    Journey.getActiveBySession = async () => null;
    UserBadge.checkAndUnlock = async () => [];

    const req = {
        method: 'POST',
        body: { slug: 'diem-thu-nghiem', lat: 10, lng: 106, method: 'qr' },
        cookies: { session_uuid: 'uuid-1' },
        session: { user: { id: 'user-1' } }
    };
    const res = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            responseBody = body;
            return body;
        }
    };

    try {
        await ApiController.checkin(req, res);

        assert.equal(res.statusCode, 200);
        assert.equal(responseBody.success, true);
        assert.equal(createdCheckin.user_id, 'user-1');
    } finally {
        UserSession.findByUuid = originals.findByUuid;
        UserSession.addPoints = originals.addPoints;
        Destination.findBySlug = originals.findBySlug;
        CheckIn.existsForStop = originals.existsForStop;
        CheckIn.create = originals.create;
        Journey.getActiveBySession = originals.getActiveBySession;
        UserBadge.checkAndUnlock = originals.checkAndUnlock;
        Model.haversine = originals.haversine;
    }
});

test('check-in rejects a visitor farther than 5 km from the destination', async () => {
    const originals = {
        findByUuid: UserSession.findByUuid,
        findBySlug: Destination.findBySlug,
        haversine: Model.haversine
    };
    let responseBody = null;

    UserSession.findByUuid = async () => ({ id: 'session-1', user_id: 'user-1' });
    Destination.findBySlug = async () => ({
        id: 'destination-1',
        name: 'Điểm thử nghiệm',
        points: 20,
        lat: 10,
        lng: 106,
        radius_meter: 100
    });
    Model.haversine = () => 5001;

    const req = {
        method: 'POST',
        body: { slug: 'diem-thu-nghiem', lat: 10, lng: 106, method: 'qr' },
        cookies: { session_uuid: 'uuid-1' },
        session: { user: { id: 'user-1' } }
    };
    const res = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            responseBody = body;
            return body;
        }
    };

    try {
        await ApiController.checkin(req, res);

        assert.equal(res.statusCode, 400);
        assert.equal(responseBody.success, false);
        assert.equal(responseBody.error_type, 'OUT_OF_RADIUS');
    } finally {
        UserSession.findByUuid = originals.findByUuid;
        Destination.findBySlug = originals.findBySlug;
        Model.haversine = originals.haversine;
    }
});

test('legacy check-ins are linked and credited only while user_id is missing', async () => {
    const originalDb = CheckIn.db;
    let query = null;

    CheckIn.db = {
        async query(sql) {
            query = sql;
            return [[{ updated_users: 1 }]];
        }
    };

    try {
        const updatedUsers = await CheckIn.backfillLinkedUserPoints();

        assert.equal(updatedUsers, 1);
        assert.match(query, /ci\.user_id\s+IS\s+NULL/i);
        assert.match(query, /SET\s+user_id\s*=\s*us\.user_id/i);
        assert.match(query, /UPDATE\s+users/i);
        assert.match(query, /points_earned/i);
    } finally {
        CheckIn.db = originalDb;
    }
});
