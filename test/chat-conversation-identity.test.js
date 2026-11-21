const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const ApiController = require('../src/controllers/ApiController');
const UserSession = require('../src/models/UserSession');
const db = require('../src/core/database');

function response() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return payload; }
    };
}

test('customer message uses account identity instead of the rotating browser session', async () => {
    const originalQuery = db.query;
    const originalFindOrCreate = UserSession.findOrCreate;
    const calls = [];
    db.query = async (sql, params) => {
        calls.push({ sql, params });
        if (/SELECT COUNT\(\*\)/.test(sql)) return [[{ total: 0 }]];
        if (/SELECT id FROM users WHERE managed_destination_id/.test(sql)) return [[]];
        return [[]];
    };
    UserSession.findOrCreate = async () => ({ id: 'rotated-session-id', uuid: 'rotated-session-uuid', user_id: 'customer-1' });
    try {
        const res = response();
        await ApiController.sendMessage({
            body: { destinationId: 'destination-1', message: 'Xin chào' }, user: { id: 'customer-1', role: 'user' },
            session: { user: { id: 'customer-1' } }, cookies: { session_uuid: 'rotated-session-uuid' }, headers: {}
        }, res);
        const insert = calls.find(call => /INSERT INTO messages/.test(call.sql));
        assert.match(insert.sql, /conversation_user_id/);
        assert.equal(insert.params[4], 'customer-1');
        assert.equal(insert.params[2], 'rotated-session-id');
        assert.equal(res.payload.success, true);
    } finally {
        db.query = originalQuery;
        UserSession.findOrCreate = originalFindOrCreate;
    }
});

test('staff reply retains the customer conversation identity', async () => {
    const originalQuery = db.query;
    const calls = [];
    db.query = async (sql, params) => { calls.push({ sql, params }); return [[]]; };
    try {
        const res = response();
        const manager = { id: 'manager-1', role: 'manager', role_id: 2, managed_destination_id: 'destination-1' };
        await ApiController.replyMessage({
            body: { sessionId: 'customer-1', replyText: 'Chào bạn', destinationId: 'destination-1' }, user: manager, session: { user: manager }
        }, res);
        const insert = calls.find(call => /INSERT INTO messages/.test(call.sql));
        assert.match(insert.sql, /conversation_user_id/);
        assert.equal(insert.params[3], 'customer-1');
        assert.equal(res.payload.success, true);
    } finally {
        db.query = originalQuery;
    }
});

test('migration backfills legacy replies and indexes the stable conversation key', () => {
    const source = fs.readFileSync('scripts/apply_chat_conversation_identity_schema.js', 'utf8');
    assert.match(source, /ADD COLUMN IF NOT EXISTS conversation_user_id/);
    assert.match(source, /m\.sender_uuid IS NOT NULL/);
    assert.doesNotMatch(source, /u\.role = 'user'/);
    assert.match(source, /previous\.sender_uuid = m\.receiver_uuid/);
    assert.match(source, /idx_messages_conversation_user/);
});

test('chat history resolves a visitor directly from the stable user id when no session remains', () => {
    const adminSource = fs.readFileSync('src/controllers/AdminController.js', 'utf8');
    const managerSource = fs.readFileSync('src/controllers/ManagerController.js', 'utf8');

    for (const source of [adminSource, managerSource]) {
        assert.match(source, /FROM users u\s+LEFT JOIN LATERAL \(/);
        assert.match(source, /WHERE u\.id::text = \$1/);
        assert.match(source, /match_priority/);
    }
});
