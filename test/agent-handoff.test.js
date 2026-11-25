const test = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { createAgentHandoffController } = require('../src/controllers/AgentHandoffController');
const { createHelpdeskAgentClient } = require('../src/services/HelpdeskAgentClient');
const cookie = 'f9d3b46b-fdc6-43c9-9d10-1bb22810abf7';
function req(body = {}) { return { body, user: { id: 'customer-1' }, cookies: { agent_conversation_id: cookie, session_uuid: cookie } }; }
function res() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; }, cookie() {} }; }
function previewIdOf(value) {
    const hex = createHash('sha256').update(`handoff:customer-1:${value}`).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
const customerPreview = {
    preview_id: 'preview-1',
    summary: 'Bản tóm tắt sẽ gửi cho nhân viên:\n- Vấn đề: Đổi lịch booking',
    expires_at: '2026-11-29T00:00:00+00:00',
    issue: 'Đổi lịch booking',
    customer_statements: ['Đổi lịch booking'],
    verified_facts: [],
    attempted_steps: [],
    reason: 'Khách yêu cầu gặp nhân viên.',
    delivery: 'pending'
};
const packet = { goal: 'Đổi lịch booking', customer_preview: customerPreview };
function memoryDatabase({ messageExists = false, writes = [], updates = [] } = {}) {
    return {
        async query(sql, params) {
            if (sql.startsWith('SELECT id')) return [messageExists ? [{ id: params[0] }] : []];
            if (sql.startsWith('SELECT')) return [[]];
            if (sql.startsWith('UPDATE')) { updates.push({ sql, params }); return [[{ id: 'session-1' }]]; }
            writes.push({ sql, params });
            return [[]];
        }
    };
}
test('preview stores and returns the exact server summary with its preview id', async () => {
    const calls = [];
    const controller = createAgentHandoffController({ client: {
        async chat(input) {
            calls.push(input);
            return { type: 'clarification_required', question: 'Bạn có muốn gửi cho nhân viên không?', summary: customerPreview.summary,
                previewId: 'preview-1', options: ['Gửi cho nhân viên', 'Để sau'], allowFreeText: false, missingFields: ['handoff_confirmation'] };
        }
    }, database: { query() { throw new Error('preview must not write'); } } });
    const output = res();
    await controller.preview(req({ userId: 'attacker', conversationId: 'other', summary: 'forged' }), output);
    assert.equal(output.statusCode, 200);
    assert.equal(calls[0].principalId, 'customer-1');
    assert.equal(calls[0].conversationId, `web-${cookie}`);
    assert.equal(calls[0].message, 'Tôi muốn gặp nhân viên hỗ trợ');
    assert.deepEqual(output.body.data, {
        status: 'preview', previewId: 'preview-1', summary: customerPreview.summary, sendLabel: 'Gửi cho nhân viên'
    });
});
test('preview recovers a paused handoff and reports pending without a message', async () => {
    const writes = [];
    const controller = createAgentHandoffController({ client: {
        async chat() { throw Object.assign(new Error('paused'), { code: 'AGENT_CONVERSATION_PAUSED' }); },
        async pendingHandoff() { return { handoffId: 'handoff-7', packet }; }
    }, database: memoryDatabase({ writes }) });
    const output = res();
    await controller.preview(req(), output);
    assert.equal(output.statusCode, 200);
    assert.equal(output.body.data.status, 'pending');
    assert.equal(output.body.data.written, false);
    assert.equal(output.body.data.handoffId, 'handoff-7');
    assert.equal(output.body.data.previewId, 'preview-1');
    assert.equal(output.body.data.summary, customerPreview.summary);
    assert.equal(writes.length, 0);
});
test('preview finishes delivery when the live chat already stored the message', async () => {
    const acknowledgements = [];
    const controller = createAgentHandoffController({ client: {
        async chat() { throw Object.assign(new Error('paused'), { code: 'AGENT_CONVERSATION_PAUSED' }); },
        async pendingHandoff() { return { handoffId: 'handoff-7', packet }; },
        async acknowledgeHandoff(input) { acknowledgements.push(input.handoffId); return { delivery: 'sent' }; }
    }, database: memoryDatabase({ messageExists: true }) });
    const output = res();
    await controller.preview(req(), output);
    assert.equal(output.body.data.status, 'sent');
    assert.equal(output.body.data.messageId, previewIdOf('preview-1'));
    assert.deepEqual(acknowledgements, ['handoff-7']);
});
test('send writes the customer-edited summary with a deterministic id, then acknowledges', async () => {
    const calls = [];
    const writes = [];
    const controller = createAgentHandoffController({ client: {
        async chat(input) { calls.push(['chat', input]); return { type: 'handoff', handoffId: 'handoff-9' }; },
        async handoff(input) { calls.push(['handoff', input]); return { packet }; },
        async acknowledgeHandoff(input) { calls.push(['ack', input]); return { delivery: 'sent' }; }
    }, sessions: { async findOrCreate() { return { id: 'session-1', user_id: 'customer-1' }; } },
    database: memoryDatabase({ writes }) });
    const output = res();
    await controller.send(req({ previewId: 'preview-1', summary: 'Tôi cần đổi lịch booking sang ngày khác.', destinationId: 'dest-1' }), output);
    assert.equal(output.statusCode, 200);
    assert.deepEqual(calls.map(call => call[0]), ['chat', 'handoff', 'ack']);
    assert.equal(calls[0][1].message, 'Gửi cho nhân viên');
    assert.equal(calls[0][1].handoffPreviewId, 'preview-1');
    assert.equal(calls[0][1].requestId, 'handoff-send:preview-1');
    assert.equal(calls[1][1].handoffId, 'handoff-9');
    assert.equal(calls[2][1].handoffId, 'handoff-9');
    assert.equal(output.body.data.status, 'waiting_for_human');
    assert.equal(output.body.data.previewId, 'preview-1');
    assert.equal(writes.length, 1);
    assert.match(writes[0].sql, /ON CONFLICT \(id\) DO NOTHING/);
    assert.equal(writes[0].params[0], previewIdOf('preview-1'));
    assert.equal(output.body.data.messageId, writes[0].params[0]);
    assert.equal(writes[0].params[5], 'Tôi cần đổi lịch booking sang ngày khác.\nMã bàn giao: handoff-9');
});
test('retrying a send after a timeout uses the same id and writes the summary once', async () => {
    const writes = [];
    const acknowledgements = [];
    const controller = createAgentHandoffController({ client: {
        async chat(input) {
            if (input.requestId !== 'handoff-send:preview-1') throw new Error('unstable request key');
            return { type: 'handoff', handoffId: 'handoff-1' };
        },
        async handoff() { return { packet }; },
        async acknowledgeHandoff(input) { acknowledgements.push(input.handoffId); return { delivery: 'sent' }; }
    }, sessions: { async findOrCreate() { return { id: 'session-1', user_id: 'customer-1' }; } },
    database: memoryDatabase({ writes }) });
    for (let attempt = 0; attempt < 2; attempt++) {
        const output = res();
        await controller.send(req({ previewId: 'preview-1', summary: 'Nội dung khách đã chỉnh' }), output);
        assert.equal(output.body.data.status, 'waiting_for_human');
    }
    assert.equal(writes[0].params[0], writes[1].params[0]);
    assert.match(writes[0].params[5], /Nội dung khách đã chỉnh/);
    assert.deepEqual(acknowledgements, ['handoff-1', 'handoff-1']);
});
test('send refuses a preview that no longer matches the stored handoff', async () => {
    const writes = [];
    const controller = createAgentHandoffController({ client: {
        async chat() { return { type: 'handoff', handoffId: 'handoff-1' }; },
        async handoff() {
            return { packet: { ...packet, customer_preview: { ...customerPreview,
                preview_id: 'preview-2', summary: 'Bản tóm tắt mới' } } };
        }
    }, database: memoryDatabase({ writes }) });
    const output = res();
    await controller.send(req({ previewId: 'preview-1', summary: customerPreview.summary }), output);
    assert.equal(output.statusCode, 200);
    assert.equal(output.body.data.status, 'preview');
    assert.equal(output.body.data.previewId, 'preview-2');
    assert.equal(output.body.data.summary, 'Bản tóm tắt mới');
    assert.equal(writes.length, 0);
});
test('send surfaces a rebuilt preview when the incident changed without a pause', async () => {
    const writes = [];
    const controller = createAgentHandoffController({ client: {
        async chat() {
            return { type: 'clarification_required', question: 'Bạn có muốn gửi cho nhân viên không?',
                summary: 'Bản tóm tắt mới', previewId: 'preview-3', missingFields: ['handoff_confirmation'],
                options: ['Gửi cho nhân viên', 'Để sau'] };
        }
    }, database: memoryDatabase({ writes }) });
    const output = res();
    await controller.send(req({ previewId: 'preview-1', summary: customerPreview.summary }), output);
    assert.equal(output.statusCode, 200);
    assert.equal(output.body.data.status, 'preview');
    assert.equal(output.body.data.previewId, 'preview-3');
    assert.equal(output.body.data.summary, 'Bản tóm tắt mới');
    assert.equal(writes.length, 0);
});
test('send does not write twice when an earlier attempt already delivered', async () => {
    const writes = [];
    const controller = createAgentHandoffController({ client: {
        async chat() { return { type: 'handoff', handoffId: 'handoff-1' }; },
        async handoff() { return { packet: { ...packet, customer_preview: { ...customerPreview, delivery: 'sent' } } }; }
    }, database: memoryDatabase({ writes }) });
    const output = res();
    await controller.send(req({ previewId: 'preview-1', summary: customerPreview.summary }), output);
    assert.equal(output.body.data.status, 'sent');
    assert.equal(output.body.data.messageId, previewIdOf('preview-1'));
    assert.equal(writes.length, 0);
});
test('send rejects a live-chat session owned by another account', async () => {
    const writes = [];
    const controller = createAgentHandoffController({ client: {
        async chat() { return { type: 'handoff', handoffId: 'handoff-1' }; },
        async handoff() { return { packet }; }
    }, sessions: { async findOrCreate() { return { id: 'session-1', user_id: 'other-user' }; } },
    database: memoryDatabase({ writes }) });
    const output = res();
    await controller.send(req({ previewId: 'preview-1', summary: customerPreview.summary }), output);
    assert.equal(output.statusCode, 403);
    assert.equal(writes.length, 0);
});
test('invalid, expired and anonymous requests fail safely', async () => {
    const controller = createAgentHandoffController({ client: {
        async handoff() { throw Object.assign(new Error('private'), { code: 'HANDOFF_EXPIRED' }); }
    } });
    const invalid = res(); await controller.send(req({ previewId: '../bad', summary: 'Help' }), invalid); assert.equal(invalid.statusCode, 400);
    const empty = res(); await controller.send(req({ previewId: 'preview-1', summary: '   ' }), empty); assert.equal(empty.statusCode, 400);
    const expired = res(); await controller.preview(req({ handoffId: 'handoff-1' }), expired); assert.equal(expired.statusCode, 410);
    assert.doesNotMatch(JSON.stringify(expired.body), /private/);
    const anonymous = res(); await controller.preview({ body: {} }, anonymous); assert.equal(anonymous.statusCode, 401);
});
test('edited summary is bounded and redacted before live-chat storage', async () => {
    const writes = [];
    const controller = createAgentHandoffController({ client: {
        async chat() { return { type: 'handoff', handoffId: 'handoff-1' }; },
        async handoff() { return { packet }; },
        async acknowledgeHandoff() { return { delivery: 'sent' }; }
    }, sessions: { async findOrCreate() { return { id: 'session-1', user_id: 'customer-1' }; } },
    database: memoryDatabase({ writes }) });
    const output = res();
    await controller.send(req({
        previewId: 'preview-1',
        summary: 'Liên hệ me@example.com, token=private-secret để hỗ trợ.'
    }), output);
    assert.equal(output.statusCode, 200);
    assert.doesNotMatch(writes[0].params[5], /me@example.com|private-secret/);
});
test('handoff delivery acknowledgement uses the authenticated backend transport', async () => {
    let captured;
    const client = createHelpdeskAgentClient({ env: { AI_SERVICE_CHAT_URL: 'http://127.0.0.1:8100/api/v1/chat', AI_SERVICE_AUTH_TOKEN: 'test-only-service-credential-longer-than-32' },
        httpClient: { async post(url, body, options) { captured = { url, body, options }; return { data: { success: true, data: { handoffId: 'ho-1', delivery: 'sent', deliveredAt: '2026-11-22T01:00:00+00:00' } } }; } } });
    const receipt = await client.acknowledgeHandoff({ handoffId: 'ho-1', conversationId: `web-${cookie}`, principalId: 'customer-1', principalRole: 'customer', requestId: 'request-2' });
    const url = new URL(captured.url);
    assert.equal(url.pathname, '/api/v1/handoffs/ho-1/delivery');
    assert.equal(url.searchParams.get('conversationId'), `web-${cookie}`);
    assert.equal(captured.body, null);
    assert.equal(captured.options.headers.Authorization.startsWith('Bearer '), true);
    assert.equal(captured.options.headers['X-Principal-ID'], 'customer-1');
    assert.equal(captured.options.maxRedirects, 0);
    assert.equal(receipt.delivery, 'sent');
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
test('pending handoff client recovers the open pause for the same conversation', async () => {
    let captured;
    const client = createHelpdeskAgentClient({ env: { AI_SERVICE_CHAT_URL: 'http://127.0.0.1:8100/api/v1/chat', AI_SERVICE_AUTH_TOKEN: 'test-only-service-credential-longer-than-32' },
        httpClient: { async get(url, options) { captured = { url, options }; return { data: { success: true, data: { handoffId: 'ho-1', packet } } }; } } });
    const result = await client.pendingHandoff({ conversationId: `web-${cookie}`, principalId: 'customer-1', principalRole: 'customer', requestId: 'request-3' });
    const url = new URL(captured.url);
    assert.equal(url.pathname, '/api/v1/handoffs/pending');
    assert.equal(url.searchParams.get('conversationId'), `web-${cookie}`);
    assert.equal(captured.options.headers['X-Principal-ID'], 'customer-1');
    assert.equal(result.handoffId, 'ho-1');
});
test('chat forwards the reviewed preview id with the send label', async () => {
    let captured;
    const client = createHelpdeskAgentClient({ env: { AI_SERVICE_CHAT_URL: 'http://127.0.0.1:8100/api/v1/chat', AI_SERVICE_AUTH_TOKEN: 'test-only-service-credential-longer-than-32' },
        httpClient: { async post(url, body, options) { captured = { url, body, options }; return { data: { success: true, data: { output: { type: 'handoff', handoffId: 'ho-1', message: 'ok', reason: 'user_requested' } } } }; } } });
    await client.chat({ message: 'Gửi cho nhân viên', handoffPreviewId: 'preview-1', conversationId: `web-${cookie}`, principalId: 'customer-1', principalRole: 'customer', requestId: 'handoff-send:preview-1' });
    assert.deepEqual(captured.body, { message: 'Gửi cho nhân viên', handoffPreviewId: 'preview-1' });
});
