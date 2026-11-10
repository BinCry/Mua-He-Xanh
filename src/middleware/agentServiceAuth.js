const crypto = require('crypto');

const MIN_SERVICE_TOKEN_LENGTH = 32;

function tokenDigest(value) {
    return crypto.createHash('sha256').update(value).digest();
}

function createAgentServiceAuth({ env = process.env } = {}) {
    return function agentServiceAuth(req, res, next) {
        const configuredToken = String(env.BINHLOI_AGENT_SERVICE_TOKEN || '');
        if (configuredToken.length < MIN_SERVICE_TOKEN_LENGTH) {
            return res.status(503).json({
                success: false,
                code: 'AGENT_SERVICE_NOT_CONFIGURED',
                message: 'Internal agent integration is not configured.'
            });
        }

        const authorization = String(req.get?.('authorization') || req.headers?.authorization || '');
        const suppliedToken = authorization.startsWith('Bearer ')
            ? authorization.slice('Bearer '.length)
            : '';
        const authenticated = suppliedToken.length >= MIN_SERVICE_TOKEN_LENGTH &&
            crypto.timingSafeEqual(tokenDigest(suppliedToken), tokenDigest(configuredToken));

        if (!authenticated) {
            res.setHeader('WWW-Authenticate', 'Bearer');
            return res.status(401).json({
                success: false,
                code: 'AGENT_SERVICE_UNAUTHORIZED',
                message: 'Unauthorized.'
            });
        }

        return next();
    };
}

module.exports = {
    MIN_SERVICE_TOKEN_LENGTH,
    createAgentServiceAuth,
    agentServiceAuth: createAgentServiceAuth()
};
