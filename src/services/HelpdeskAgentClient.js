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

function createHelpdeskAgentClient({ httpClient = axios, env = process.env } = {}) {
    return {
        async chat({ message, conversationId, principalId, principalRole, requestId }) {
            const endpoint = String(env.AI_SERVICE_CHAT_URL || '').trim();
            const token = String(env.AI_SERVICE_AUTH_TOKEN || '').trim();
            if (!endpoint || token.length < MIN_TOKEN_LENGTH) {
                throw new AgentServiceError('AGENT_NOT_CONFIGURED');
            }

            let parsedEndpoint;
            try {
                parsedEndpoint = new URL(endpoint);
            } catch (_) {
                throw new AgentServiceError('AGENT_ENDPOINT_INVALID');
            }

            const secureTransport = parsedEndpoint.protocol === 'https:';
            const localDevelopmentTransport =
                env.NODE_ENV !== 'production' &&
                parsedEndpoint.protocol === 'http:' &&
                isLoopback(parsedEndpoint.hostname);
            if (
                (!secureTransport && !localDevelopmentTransport) ||
                parsedEndpoint.username ||
                parsedEndpoint.password ||
                parsedEndpoint.search ||
                parsedEndpoint.hash
            ) {
                throw new AgentServiceError('AGENT_ENDPOINT_INVALID');
            }

            let response;
            try {
                response = await httpClient.post(
                    parsedEndpoint.toString(),
                    { message },
                    {
                        timeout: REQUEST_TIMEOUT_MS,
                        // Không để proxy môi trường nhìn thấy bearer token nội bộ.
                        proxy: false,
                        maxRedirects: 0,
                        maxContentLength: 256 * 1024,
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json',
                            'X-Conversation-ID': conversationId,
                            'X-Principal-ID': principalId,
                            'X-Principal-Role': principalRole,
                            'X-Request-ID': requestId
                        }
                    }
                );
            } catch (_) {
                // Không gắn lỗi axios vào response hoặc log vì nó có thể chứa header nội bộ.
                throw new AgentServiceError('AGENT_UNAVAILABLE');
            }

            const output = response?.data?.data?.output;
            if (response?.data?.success !== true || !output || typeof output.type !== 'string') {
                throw new AgentServiceError('AGENT_RESPONSE_INVALID');
            }

            return output;
        }
    };
}

module.exports = {
    AgentServiceError,
    createHelpdeskAgentClient
};
