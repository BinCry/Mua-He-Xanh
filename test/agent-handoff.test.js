const test = require('node:test');
const assert = require('node:assert/strict');
const { createAgentHandoffController, summaryFromPacket } = require('../src/controllers/AgentHandoffController');
const { createHelpdeskAgentClient } = require('../src/services/HelpdeskAgentClient');
const cookie = 'f9d3b46b-fdc6-43c9-9d10-1bb22810abf7';
function req(body = {}) { return { body, user: { id: 'customer-1' }, cookies: { agent_conversation_id: cookie, session_uuid: cookie } }; }
function res() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; }, cookie() {} }; }
const packet = { goal: 'Đổi lịch booking', decisions: [{ summary: 'Đã tra cứu booking' }], findings: [{ title: 'Booking', citation_id: 'S1' }] };
test('preview creates a real handoff with trusted identity and no message write', async () => {
    const calls = [];
    const controller = createAgentHandoffController({ client: {
        async chat(input) { calls.push(input); return { type: 'handoff', handoffId: 'handoff-1' }; },
        async handoff(input) { calls.push(input); return { packet }; }
    }, database: { query() { throw new Error('preview must not send'); } } });
    const output = res();
    await controller.preview(req({ userId: 'attacker', conversationId: 'other' }), output);
    assert.equal(output.statusCode, 200);
    assert.equal(calls[0].principalId, 'customer-1');
    assert.equal(calls[0].conversationId, `web-${cookie}`);
    assert.equal(output.body.data.handoffId, 'handoff-1');
    assert.match(output.body.data.summary, /Đã tra cứu booking/);
});
test('send ignores forged summary, uses canonical packet, and has stable deduplication ID', async () => {
    const writes = [];
    const controller = createAgentHandoffController({ client: { async handoff() { return { packet }; } },
        sessions: { async findOrCreate() { return { id: 'session-1', user_id: 'customer-1' }; } },
        database: { async query(sql, params) { if (sql.startsWith('UPDATE')) return [[{ id: 'session-1' }]]; writes.push({ sql, params }); return [[]]; } } });
    for (let n = 0; n < 2; n++) {
        const output = res();
        await controller.send(req({ handoffId: 'handoff-1', summary: 'forged', note: 'Xin hỗ trợ' }), output);
        assert.equal(output.body.data.status, 'waiting_for_human');
    }
    assert.equal(writes[0].params[0], writes[1].params[0]);
    assert.match(writes[0].sql, /ON CONFLICT \(id\) DO NOTHING/);
    assert.match(writes[0].params[5], /Đổi lịch booking/);
    assert.doesNotMatch(writes[0].params[5], /forged/);
});
test('handoff uses the main chat session cookie, ignoring a stale agent-only cookie', async () => {
    const calls = [];
    const controller = createAgentHandoffController({ client: { async handoff(input) { calls.push(input); return { packet }; } } });
    const request = req({ handoffId: 'handoff-1' });
    request.cookies.agent_conversation_id = '11111111-1111-4111-8111-111111111111';
    const output = res();
    await controller.preview(request, output);
    assert.equal(output.statusCode, 200);
    assert.equal(calls[0].conversationId, `web-${cookie}`);
});
test('send rejects a live-chat session owned by another account', async () => {
    let writes = 0;
    const controller = createAgentHandoffController({ client: { async handoff() { return { packet }; } },
        sessions: { async findOrCreate() { return { id: 'session-1', user_id: 'other-user' }; } },
        database: { async query() { writes++; } } });
    const output = res();
    await controller.send(req({ handoffId: 'handoff-1' }), output);
    assert.equal(output.statusCode, 403);
    assert.equal(writes, 0);
});
test('invalid, expired and anonymous requests fail safely', async () => {
    const controller = createAgentHandoffController({ client: { async handoff() { throw Object.assign(new Error('private'), { code: 'HANDOFF_EXPIRED' }); } } });
    const invalid = res(); await controller.send(req({ handoffId: '../bad' }), invalid); assert.equal(invalid.statusCode, 400);
    const expired = res(); await controller.preview(req({ handoffId: 'handoff-1' }), expired); assert.equal(expired.statusCode, 410);
    assert.doesNotMatch(JSON.stringify(expired.body), /private/);
    const anonymous = res(); await controller.preview({ body: {} }, anonymous); assert.equal(anonymous.statusCode, 401);
});
test('public summary bounds payload and masks common contact details and secrets', () => {
    const summary = summaryFromPacket({ goal: 'Contact me@example.com +84901234567 token=private ' + 'x'.repeat(5000) });
    assert.ok(summary.length <= 1800);
    assert.doesNotMatch(summary, /me@example.com|84901234567|private/);
});
test('handoff client uses authenticated safe transport and exact conversation', async () => {
    let captured;
    const client = createHelpdeskAgentClient({ env: { AI_SERVICE_CHAT_URL: 'http://127.0.0.1:8100/api/v1/chat', AI_SERVICE_AUTH_TOKEN: 'test-only-service-credential-longer-than-32' },
        httpClient: { async get(url, options) { captured = { url, options }; return { data: { success: true, data: { handoffId: 'ho-1', packet } } }; } } });
    await client.handoff({ handoffId: 'ho-1', conversationId: `web-${cookie}`, principalId: 'customer-1', principalRole: 'customer', requestId: 'request-1' });
    const url = new URL(captured.url);
    assert.equal(url.pathname, '/api/v1/handoffs/ho-1');
    assert.equal(url.searchParams.get('conversationId'), `web-${cookie}`);
    assert.equal(captured.options.headers['X-Principal-ID'], 'customer-1');
    assert.equal(captured.options.maxRedirects, 0);
});
