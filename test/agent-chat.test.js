const assert = require('node:assert/strict');
const test = require('node:test');

const { createAgentChatController } = require('../src/controllers/AgentChatController');
const {
    AgentServiceError,
    createHelpdeskAgentClient
} = require('../src/services/HelpdeskAgentClient');

const SESSION_UUID = 'f9d3b46b-fdc6-43c9-9d10-1bb22810abf7';
const TEST_TOKEN = 'test-service-token-with-at-least-32-characters';

function response() {
    return {
        statusCode: 200,
        body: null,
        cookies: [],
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return body;
        },
        cookie(name, value, options) {
            this.cookies.push({ name, value, options });
        }
    };
}

test('web route sends server-owned identity and returns only the public output', async () => {
    let request;
    const controller = createAgentChatController({
        client: {
            async chat(value) {
                request = value;
                return {
                    type: 'answer',
                    message: 'Có các điểm đến phù hợp.',
                    citations: [{ id: 'S1', title: 'Bình Lợi', url: '/explore/binh-loi' }]
                };
            }
        }
    });
    const res = response();

    await controller.chat({
        body: { message: '  Bình Lợi có gì?  ' },
        cookies: { session_uuid: SESSION_UUID },
        user: { id: 'customer-123', role: 'user', role_id: 3 }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(request.message, 'Bình Lợi có gì?');
    assert.equal(request.conversationId, `web-${SESSION_UUID}`);
    assert.equal(request.principalId, 'customer-123');
    assert.equal(request.principalRole, 'customer');
    assert.match(request.requestId, /^[0-9a-f-]{36}$/i);
    assert.deepEqual(res.body, {
        success: true,
        data: {
            output: {
                type: 'answer',
                message: 'Có các điểm đến phù hợp.',
                citations: [{ id: 'S1', title: 'Bình Lợi', url: '/explore/binh-loi' }]
            }
        }
    });
});

test('web route maps administrators from trusted session data', async () => {
    let request;
    const controller = createAgentChatController({
        client: { async chat(value) { request = value; return { type: 'abstain', message: 'Không đủ căn cứ.' }; } }
    });

    await controller.chat({
        body: { message: 'Câu hỏi quản trị' },
        cookies: { session_uuid: SESSION_UUID },
        session: { user: { id: 'admin-1', role: 'admin', role_id: 1 } }
    }, response());

    assert.equal(request.principalRole, 'admin');
    assert.equal(request.principalId, 'admin-1');
});

test('web route rejects missing users and invalid text before calling the agent', async () => {
    let calls = 0;
    const controller = createAgentChatController({ client: { async chat() { calls += 1; } } });
    const noUser = response();
    await controller.chat({ body: { message: 'Xin chào' } }, noUser);
    assert.equal(noUser.statusCode, 401);

    const invalidMessage = response();
    await controller.chat({
        body: { message: '   ' },
        user: { id: 'customer-123' }
    }, invalidMessage);
    assert.equal(invalidMessage.statusCode, 400);
    assert.equal(calls, 0);
});

test('web route creates a secure session identifier and hides upstream failures', async () => {
    const controller = createAgentChatController({
        client: { async chat() { throw new Error('Bearer secret must not be returned'); } }
    });
    const res = response();

    await controller.chat({
        body: { message: 'Bình Lợi có gì?' },
        cookies: {},
        user: { id: 'customer-123' }
    }, res);

    assert.equal(res.statusCode, 503);
    assert.match(res.body.message, /tạm thời không khả dụng/i);
    assert.doesNotMatch(JSON.stringify(res.body), /Bearer|secret/i);
    assert.equal(res.cookies.length, 1);
    assert.equal(res.cookies[0].options.httpOnly, true);
    assert.equal(res.cookies[0].options.sameSite, 'lax');
});

test('agent client sends the backend credential to HTTPS or a loopback endpoint', async () => {
    let captured;
    const client = createHelpdeskAgentClient({
        env: {
            NODE_ENV: 'production',
            AI_SERVICE_CHAT_URL: 'http://127.0.0.1:8100/api/v1/chat',
            AI_SERVICE_AUTH_TOKEN: TEST_TOKEN
        },
        httpClient: {
            async post(...args) {
                captured = args;
                return {
                    data: {
                        success: true,
                        data: {
                            conversationId: 'private-conversation-id',
                            messageId: 'private-run-id',
                            output: { type: 'abstain', message: 'Không đủ căn cứ.' }
                        }
                    }
                };
            }
        }
    });

    const output = await client.chat({
        message: 'Bình Lợi có gì?',
        conversationId: `web-${SESSION_UUID}`,
        principalId: 'customer-123',
        principalRole: 'customer',
        requestId: SESSION_UUID
    });

    assert.equal(captured[0], 'http://127.0.0.1:8100/api/v1/chat');
    assert.deepEqual(captured[1], { message: 'Bình Lợi có gì?' });
    assert.equal(captured[2].headers.Authorization, `Bearer ${TEST_TOKEN}`);
    assert.equal(captured[2].headers['X-Principal-ID'], 'customer-123');
    assert.equal(captured[2].headers['X-Principal-Role'], 'customer');
    assert.equal(captured[2].proxy, false);
    assert.equal(captured[2].maxRedirects, 0);
    assert.equal(captured[2].timeout, 35000);
    assert.deepEqual(output, { type: 'abstain', message: 'Không đủ căn cứ.' });
    assert.doesNotMatch(JSON.stringify(output), /private-conversation-id|private-run-id|test-service-token/);
});

test('agent client rejects missing credentials and unsafe transport without making a request', async () => {
    let calls = 0;
    const httpClient = { async post() { calls += 1; } };
    const payload = {
        message: 'Câu hỏi',
        conversationId: `web-${SESSION_UUID}`,
        principalId: 'customer-123',
        principalRole: 'customer',
        requestId: SESSION_UUID
    };

    const missing = createHelpdeskAgentClient({ httpClient, env: {} });
    await assert.rejects(missing.chat(payload), error => error instanceof AgentServiceError && error.code === 'AGENT_NOT_CONFIGURED');

    const remoteHttp = createHelpdeskAgentClient({
        httpClient,
        env: {
            NODE_ENV: 'production',
            AI_SERVICE_CHAT_URL: 'http://agent.internal/api/v1/chat',
            AI_SERVICE_AUTH_TOKEN: TEST_TOKEN
        }
    });
    await assert.rejects(remoteHttp.chat(payload), error => error instanceof AgentServiceError && error.code === 'AGENT_ENDPOINT_INVALID');
    assert.equal(calls, 0);

    const endpointWithQuery = createHelpdeskAgentClient({
        httpClient,
        env: {
            NODE_ENV: 'production',
            AI_SERVICE_CHAT_URL: 'https://agent.example.test/api/v1/chat?token=not-allowed',
            AI_SERVICE_AUTH_TOKEN: TEST_TOKEN
        }
    });
    await assert.rejects(endpointWithQuery.chat(payload), error => error instanceof AgentServiceError && error.code === 'AGENT_ENDPOINT_INVALID');
    assert.equal(calls, 0);
});

test('agent client strips transport details from service errors', async () => {
    const client = createHelpdeskAgentClient({
        env: {
            NODE_ENV: 'production',
            AI_SERVICE_CHAT_URL: 'https://agent.example.test/api/v1/chat',
            AI_SERVICE_AUTH_TOKEN: TEST_TOKEN
        },
        httpClient: { async post() { throw new Error(`Authorization: Bearer ${TEST_TOKEN}`); } }
    });

    await assert.rejects(client.chat({
        message: 'Câu hỏi',
        conversationId: `web-${SESSION_UUID}`,
        principalId: 'customer-123',
        principalRole: 'customer',
        requestId: SESSION_UUID
    }), error => {
        assert.equal(error.code, 'AGENT_UNAVAILABLE');
        assert.doesNotMatch(error.message, /Bearer|test-service-token/);
        return true;
    });
});
