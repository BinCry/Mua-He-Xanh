const axios = require('axios');

const REQUEST_TIMEOUT_MS = 35000;
const MIN_TOKEN_LENGTH = 32;

class AgentServiceError extends Error {
    constructor(code) {
        super(code);
        this.name = 'AgentServiceError';
        this.code = code;
    }
}

function isLoopback(hostname) {
    return ['127.0.0.1', 'localhost', '[::1]'].includes(hostname.toLowerCase());
}

function serviceConfig(env) {
    const endpoint = String(env.AI_SERVICE_CHAT_URL || '').trim();
    const token = String(env.AI_SERVICE_AUTH_TOKEN || '').trim();
    if (!endpoint || token.length < MIN_TOKEN_LENGTH) throw new AgentServiceError('AGENT_NOT_CONFIGURED');
    let url;
    try { url = new URL(endpoint); } catch (_) { throw new AgentServiceError('AGENT_ENDPOINT_INVALID'); }
    const secure = url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback(url.hostname));
    if (!secure || url.username || url.password || url.search || url.hash) {
        throw new AgentServiceError('AGENT_ENDPOINT_INVALID');
    }
    return { url, token };
}

function serviceHeaders(token, { conversationId, principalId, principalRole, requestId }) {
    return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Conversation-ID': conversationId,
        'X-Principal-ID': principalId,
        'X-Principal-Role': principalRole,
        'X-Request-ID': requestId
    };
}

function requestOptions(headers) {
    return { timeout: REQUEST_TIMEOUT_MS, proxy: false, maxRedirects: 0, maxContentLength: 256 * 1024, headers };
}

function auxiliaryUrl(url, suffix) {
    if (!/\/chat\/?$/.test(url.pathname)) throw new AgentServiceError('AGENT_ENDPOINT_INVALID');
    const target = new URL(url);
    target.pathname = url.pathname.replace(/\/chat\/?$/, suffix);
    return target.toString();
}

function safeServiceFailure(error, operation = 'chat') {
    if (error?.response?.status === 409) {
        return new AgentServiceError(operation === 'resume' ? 'AGENT_PAUSE_CONFLICT' : 'AGENT_CONVERSATION_PAUSED');
    }
    if (error?.response?.status === 403) return new AgentServiceError('AGENT_FORBIDDEN');
    if (error?.response?.status === 404) return new AgentServiceError('AGENT_NOT_FOUND');
    if (error?.response?.status === 410) return new AgentServiceError('AGENT_RECEIPT_EXPIRED');
    return new AgentServiceError('AGENT_UNAVAILABLE');
}

function createHelpdeskAgentClient({ httpClient = axios, env = process.env } = {}) {
    return {
        async personalization({ method = 'GET', key, clear = false, payload, principalId, principalRole, requestId }) {
            const token = String(env.AI_SERVICE_AUTH_TOKEN || '').trim();
            let endpoint;
            try { endpoint = new URL(String(env.AI_SERVICE_CHAT_URL || '').trim()); }
            catch (_) { throw new AgentServiceError('AGENT_NOT_CONFIGURED'); }
            if (token.length < MIN_TOKEN_LENGTH) throw new AgentServiceError('AGENT_NOT_CONFIGURED');
            if ((endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && isLoopback(endpoint.hostname))) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !/\/chat\/?$/.test(endpoint.pathname)) {
                throw new AgentServiceError('AGENT_ENDPOINT_INVALID');
            }
            const suffix = key ? `/items/${encodeURIComponent(key)}` : clear ? '/items' : '';
            endpoint.pathname = endpoint.pathname.replace(/\/chat\/?$/, `/personalization${suffix}`);
            let response;
            try {
                response = await httpClient.request({
                    method, url: endpoint.toString(), data: payload,
                    timeout: REQUEST_TIMEOUT_MS, proxy: false, maxRedirects: 0, maxContentLength: 256 * 1024,
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
                        'X-Principal-ID': principalId, 'X-Principal-Role': principalRole, 'X-Request-ID': requestId }
                });
            } catch (error) {
                const status = error?.response?.status;
                throw new AgentServiceError(status === 409 ? 'PROFILE_CONFLICT' : [400, 422].includes(status) ? 'PROFILE_INVALID' : 'AGENT_UNAVAILABLE');
            }
            const data = response?.data?.data;
            if (response?.data?.success !== true || !data || typeof data !== 'object') throw new AgentServiceError('AGENT_RESPONSE_INVALID');
            return data;
        },
        async handoff({ handoffId, conversationId, principalId, principalRole, requestId }) {
            const token = String(env.AI_SERVICE_AUTH_TOKEN || '').trim();
            let endpoint;
            try { endpoint = new URL(String(env.AI_SERVICE_CHAT_URL || '').trim()); }
            catch (_) { throw new AgentServiceError('AGENT_NOT_CONFIGURED'); }
            if (token.length < MIN_TOKEN_LENGTH) throw new AgentServiceError('AGENT_NOT_CONFIGURED');
            if ((endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' && isLoopback(endpoint.hostname))) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || !/\/chat\/?$/.test(endpoint.pathname)) {
                throw new AgentServiceError('AGENT_ENDPOINT_INVALID');
            }
            endpoint.pathname = endpoint.pathname.replace(/\/chat\/?$/, `/handoffs/${encodeURIComponent(handoffId)}`);
            endpoint.searchParams.set('conversationId', conversationId);
            let response;
            try {
                response = await httpClient.get(endpoint.toString(), {
                    timeout: REQUEST_TIMEOUT_MS, proxy: false, maxRedirects: 0, maxContentLength: 256 * 1024,
                    headers: { Authorization: `Bearer ${token}`, 'X-Conversation-ID': conversationId,
                        'X-Principal-ID': principalId, 'X-Principal-Role': principalRole, 'X-Request-ID': requestId }
                });
            } catch (error) {
                const status = error?.response?.status;
                throw new AgentServiceError(status === 410 ? 'HANDOFF_EXPIRED' : [403, 404].includes(status) ? 'HANDOFF_NOT_FOUND' : 'AGENT_UNAVAILABLE');
            }
            const data = response?.data?.data;
            if (response?.data?.success !== true || !data?.packet || typeof data.packet !== 'object') throw new AgentServiceError('AGENT_RESPONSE_INVALID');
            return data;
        },
        async acknowledgeHandoff({ handoffId, conversationId, principalId, principalRole, requestId }) {
            const { url, token } = serviceConfig(env);
            const endpoint = new URL(auxiliaryUrl(url, `/handoffs/${encodeURIComponent(handoffId)}/delivery`));
            endpoint.searchParams.set('conversationId', conversationId);
            let response;
            try {
                response = await httpClient.post(endpoint.toString(), null, requestOptions(serviceHeaders(token, {
                    conversationId, principalId, principalRole, requestId
                })));
            } catch (error) {
                if (error instanceof AgentServiceError) throw error;
                const status = error?.response?.status;
                throw new AgentServiceError(status === 410 ? 'HANDOFF_EXPIRED' : [403, 404].includes(status) ? 'HANDOFF_NOT_FOUND' : 'AGENT_UNAVAILABLE');
            }
            const data = response?.data?.data;
            if (response?.data?.success !== true || data?.delivery !== 'sent') {
                throw new AgentServiceError('AGENT_RESPONSE_INVALID');
            }
            return data;
        },
        async pendingHandoff({ conversationId, principalId, principalRole, requestId }) {
            const { url, token } = serviceConfig(env);
            const endpoint = new URL(auxiliaryUrl(url, '/handoffs/pending'));
            endpoint.searchParams.set('conversationId', conversationId);
            let response;
            try {
                response = await httpClient.get(endpoint.toString(), requestOptions(serviceHeaders(token, {
                    conversationId, principalId, principalRole, requestId
                })));
            } catch (error) {
                const status = error?.response?.status;
                throw new AgentServiceError(status === 410 ? 'HANDOFF_EXPIRED' : [403, 404].includes(status) ? 'HANDOFF_NOT_FOUND' : 'AGENT_UNAVAILABLE');
            }
            const data = response?.data?.data;
            if (response?.data?.success !== true || !data?.handoffId || !data?.packet || typeof data.packet !== 'object') {
                throw new AgentServiceError('AGENT_RESPONSE_INVALID');
            }
            return data;
        },
        async chat({ message, handoffPreviewId, conversationId, principalId, principalRole, requestId }) {
            const { url, token } = serviceConfig(env);

            let response;
            try {
                response = await httpClient.post(
                    url.toString(),
                    handoffPreviewId ? { message, handoffPreviewId } : { message },
                    requestOptions(serviceHeaders(token, { conversationId, principalId, principalRole, requestId }))
                );
            } catch (error) {
                // Không gắn lỗi axios vào response hoặc log vì nó có thể chứa header nội bộ.
                throw safeServiceFailure(error);
            }

            const output = response?.data?.data?.output;
            if (response?.data?.success !== true || !output || typeof output.type !== 'string') {
                throw new AgentServiceError('AGENT_RESPONSE_INVALID');
            }

            return output;
        },
        async pendingApprovals({ principalId, requestId, offset = 0, limit = 20 }) {
            const { url, token } = serviceConfig(env);
            const endpoint = new URL(auxiliaryUrl(url, '/approvals/pending'));
            endpoint.searchParams.set('offset', String(offset));
            endpoint.searchParams.set('limit', String(limit));
            try {
                const response = await httpClient.get(endpoint.toString(), requestOptions(serviceHeaders(token, {
                    principalId, principalRole: 'admin', requestId
                })));
                const data = response?.data?.data;
                if (response?.data?.success !== true || !Array.isArray(data?.items)
                    || data.items.length > limit || typeof data.hasMore !== 'boolean'
                    || (data.hasMore && (!Number.isSafeInteger(data.nextOffset) || data.nextOffset <= offset))) {
                    throw new AgentServiceError('AGENT_RESPONSE_INVALID');
                }
                return data;
            } catch (error) {
                if (error instanceof AgentServiceError) throw error;
                throw safeServiceFailure(error);
            }
        },
        async resume({ conversationId, pauseId, decision, note, idempotencyKey, principalId, requestId }) {
            const { url, token } = serviceConfig(env);
            const endpoint = auxiliaryUrl(url, '/chat/resume');
            try {
                const response = await httpClient.post(endpoint, {
                    pauseId, decision, note, idempotencyKey
                }, requestOptions(serviceHeaders(token, {
                    conversationId, principalId, principalRole: 'admin', requestId
                })));
                const output = response?.data?.data?.output;
                if (response?.data?.success !== true || !output || typeof output.type !== 'string') {
                    throw new AgentServiceError('AGENT_RESPONSE_INVALID');
                }
                return output;
            } catch (error) {
                if (error instanceof AgentServiceError) throw error;
                throw safeServiceFailure(error, 'resume');
            }
        },
        async clear({ conversationId, principalId, principalRole, requestId }) {
            const { url, token } = serviceConfig(env);
            const endpoint = auxiliaryUrl(url, `/conversations/${encodeURIComponent(conversationId)}/state`);
            try {
                const response = await httpClient.delete(endpoint, requestOptions(serviceHeaders(token, {
                    conversationId, principalId, principalRole, requestId
                })));
                if (response?.data?.success !== true || typeof response?.data?.data?.cleared !== 'boolean') {
                    throw new AgentServiceError('AGENT_RESPONSE_INVALID');
                }
                return response.data.data.cleared;
            } catch (error) {
                if (error instanceof AgentServiceError) throw error;
                throw safeServiceFailure(error);
            }
        }
    };
}

module.exports = {
    AgentServiceError,
    createHelpdeskAgentClient
};
