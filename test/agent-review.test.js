const assert = require('node:assert/strict');
const test = require('node:test');

const { createReviewReceipt, readReviewReceipt } = require('../src/services/AgentReviewReceipt');
const { createAgentChatController } = require('../src/controllers/AgentChatController');
const { createHelpdeskAgentClient } = require('../src/services/HelpdeskAgentClient');

const SESSION_UUID = 'f9d3b46b-fdc6-43c9-9d10-1bb22810abf7';
const SECRET_ENV = { SESSION_SECRET: 'local-test-session-secret-with-at-least-32-characters' };

function response() {
    return {
        statusCode: 200, body: null,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return body; },
        cookie() {}
    };
}

test('review receipt hides conversation identity and rejects tampering', () => {
    const receipt = createReviewReceipt({
        conversationId: `web-${SESSION_UUID}`, pauseId: 'pause-123',
        kind: 'approval', summary: 'Tạo phiếu hỗ trợ'
    }, SECRET_ENV);
    assert.match(receipt, /^ar1\./);
    assert.doesNotMatch(receipt, /pause-123|web-|Tạo phiếu/);
    assert.equal(readReviewReceipt(receipt, SECRET_ENV).pauseId, 'pause-123');
    assert.equal(readReviewReceipt(receipt, { SESSION_SECRET: 'different-test-secret-with-at-least-32-characters' }), null);
    const tampered = `${receipt.slice(0, -1)}${receipt.endsWith('A') ? 'B' : 'A'}`;
    assert.equal(readReviewReceipt(tampered, SECRET_ENV), null);
    assert.equal(createReviewReceipt({ conversationId: 'web-x', kind: 'approval' }, SECRET_ENV), null);
});

test('admin reviews an authentic preview and resumes the exact conversation', async () => {
    const calls = [];
    const controller = createAgentChatController({
        env: SECRET_ENV,
        client: {
            async chat(args) {
                calls.push({ method: 'chat', args });
                return { type: 'approval_pending', message: 'Đang chờ duyệt', approvalId: 'pause-123',
                    actionPreview: { summary: 'Tạo phiếu hỗ trợ cho khách' } };
            },
            async resume(args) {
                calls.push({ method: 'resume', args });
                return { type: 'action_completed', message: 'Đã tạo phiếu', referenceId: 'ticket-123' };
            }
        }
    });
    const chat = response();
    await controller.chat({ body: { message: 'Tôi cần hỗ trợ' }, cookies: { session_uuid: SESSION_UUID },
        user: { id: 'customer-1', role: 'user' } }, chat);
    const receipt = chat.body.data.output.reviewReceipt;
    assert.ok(receipt);

    const inspect = response();
    controller.inspectReview({ body: { receipt } }, inspect);
    assert.deepEqual(inspect.body.data, { kind: 'approval', summary: 'Tạo phiếu hỗ trợ cho khách' });
    assert.doesNotMatch(JSON.stringify(inspect.body), /web-|pause-123|customer-1/);

    const denied = response();
    await controller.resume({ body: { receipt, decision: 'approve' }, user: { id: 'customer-1', role: 'user' } }, denied);
    assert.equal(denied.statusCode, 403);

    const approved = response();
    const adminRequest = { body: { receipt, decision: 'approve', note: 'Đã kiểm tra' }, user: { id: 'admin-1', role: 'admin' } };
    await controller.resume(adminRequest, approved);
    assert.equal(approved.body.data.output.referenceId, 'ticket-123');
    assert.equal(calls[1].args.conversationId, `web-${SESSION_UUID}`);
    assert.equal(calls[1].args.pauseId, 'pause-123');
    assert.equal(calls[1].args.principalId, 'admin-1');
    assert.match(calls[1].args.idempotencyKey, /^[0-9a-f]{64}$/);
    await controller.resume(adminRequest, response());
    assert.equal(calls[2].args.idempotencyKey, calls[1].args.idempotencyKey);
});

test('clear endpoint only targets the signed-in browser conversation after confirmation', async () => {
    let target;
    const controller = createAgentChatController({ client: {
        async clear(args) { target = args; return true; }
    } });
    const req = { body: { confirm: 'clear' }, cookies: { session_uuid: SESSION_UUID },
        user: { id: 'customer-1', role: 'user' } };
    const missingConfirmation = response();
    await controller.clear({ ...req, body: {} }, missingConfirmation);
    assert.equal(missingConfirmation.statusCode, 400);
    assert.equal(target, undefined);
    const cleared = response();
    await controller.clear(req, cleared);
    assert.equal(cleared.body.data.cleared, true);
    assert.equal(target.conversationId, `web-${SESSION_UUID}`);
    assert.equal(target.principalId, 'customer-1');
    assert.equal(target.principalRole, 'customer');
});

test('agent client uses internal resume and state paths with server-owned headers', async () => {
    const calls = [];
    const client = createHelpdeskAgentClient({
        env: { AI_SERVICE_CHAT_URL: 'https://agent.example.test/api/v1/chat',
            AI_SERVICE_AUTH_TOKEN: 'test-service-token-with-at-least-32-characters' },
        httpClient: {
            async post(...args) { calls.push(['post', ...args]); return { data: { success: true,
                data: { output: { type: 'action_completed', message: 'Xong' } } } }; },
            async delete(...args) { calls.push(['delete', ...args]); return { data: { success: true,
                data: { cleared: true } } }; }
        }
    });
    await client.resume({ conversationId: 'web-session', pauseId: 'pause-123', decision: 'approve',
        note: '', idempotencyKey: 'stable-key', principalId: 'admin-1', requestId: 'request-1' });
    await client.clear({ conversationId: 'web-session', principalId: 'customer-1',
        principalRole: 'customer', requestId: 'request-2' });
    assert.equal(calls[0][1], 'https://agent.example.test/api/v1/chat/resume');
    assert.equal(calls[0][3].headers['X-Principal-Role'], 'admin');
    assert.equal(calls[0][3].proxy, false);
    assert.equal(calls[1][1], 'https://agent.example.test/api/v1/conversations/web-session/state');
    assert.equal(calls[1][2].headers['X-Principal-Role'], 'customer');
    assert.equal(calls[1][2].maxRedirects, 0);
});

test('pending approvals use admin identity, hide internal IDs and retain review decision path', async () => {
    let calls = 0;
    const controller = createAgentChatController({ env: SECRET_ENV, client: {
        async pendingApprovals(args) {
            calls += 1;
            assert.equal(args.principalId, 'admin-1');
            assert.equal(args.offset, 20);
            return { items: [{
                conversationId: 'web-original', pauseId: 'pause-original',
                summary: 'Workshop ngày 20/11 bắt đầu trễ 30 phút'
            }], hasMore: false, nextOffset: null };
        }
    } });
    const denied = response();
    await controller.pendingApprovals({ user: { id: 'customer-1', role: 'user' } }, denied);
    assert.equal(denied.statusCode, 403);
    assert.equal(calls, 0);
    const invalid = response();
    await controller.pendingApprovals({ user: { id: 'admin-1', role: 'admin' }, query: { offset: '-1' } }, invalid);
    assert.equal(invalid.statusCode, 400);
    const res = response();
    await controller.pendingApprovals({ user: { id: 'admin-1', role: 'admin' }, query: { offset: '20' } }, res);
    assert.equal(res.body.success, true);
    assert.doesNotMatch(JSON.stringify(res.body), /web-original|pause-original/);
    const receipt = readReviewReceipt(res.body.data.items[0].receipt, SECRET_ENV);
    assert.equal(receipt.conversationId, 'web-original');
    assert.equal(receipt.pauseId, 'pause-original');
});

test('queue fails visibly when receipts cannot be signed or upstream record is malformed', async () => {
    for (const item of [{ conversationId: 'web-x', pauseId: 'pause-x', summary: 'Phản ánh' }, null]) {
        const controller = createAgentChatController({ env: {}, client: {
            async pendingApprovals() { return { items: [item], hasMore: false, nextOffset: null }; }
        } });
        const res = response();
        await controller.pendingApprovals({ user: { id: 'admin-1', role: 'admin' }, query: {} }, res);
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.success, false);
    }
});

test('pending approvals client sends backend admin credentials and bounded pagination', async () => {
    const client = createHelpdeskAgentClient({
        env: { AI_SERVICE_CHAT_URL: 'http://127.0.0.1:8100/api/v1/chat', AI_SERVICE_AUTH_TOKEN: 'test-service-token-with-at-least-32-characters' },
        httpClient: { async get(url, options) {
            assert.equal(new URL(url).pathname, '/api/v1/approvals/pending');
            assert.equal(new URL(url).searchParams.get('offset'), '20');
            assert.equal(options.headers['X-Principal-Role'], 'admin');
            assert.equal(options.headers['X-Principal-ID'], 'admin-1');
            return { data: { success: true, data: { items: [], hasMore: false, nextOffset: null } } };
        } }
    });
    assert.deepEqual(await client.pendingApprovals({ principalId: 'admin-1', offset: 20, requestId: 'request-1' }), {
        items: [], hasMore: false, nextOffset: null
    });
});
