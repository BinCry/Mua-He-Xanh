const { createHmac, timingSafeEqual } = require('crypto');

const TOKEN_PREFIX = 'BLH-CHECKIN';
const TOKEN_VERSION = 'v1';
const TOKEN_WINDOW_SECONDS = 60;

function getSigningSecret() {
    const secret = String(process.env.CHECKIN_QR_SECRET || (process.env.NODE_ENV === 'production' ? '' : (process.env.SESSION_SECRET || 'development-only-session-qr-secret')));
    if (secret.length < 32) throw new Error('A 32-character CHECKIN_QR_SECRET or SESSION_SECRET is required.');
    return secret;
}

function signature(destinationId, window) {
    return createHmac('sha256', getSigningSecret())
        .update(`${TOKEN_VERSION}:${destinationId}:${window}`)
        .digest('base64url');
}

function createCheckinToken(destinationId, now = Date.now()) {
    const window = Math.floor(now / (TOKEN_WINDOW_SECONDS * 1000));
    return `${TOKEN_PREFIX}:${TOKEN_VERSION}:${destinationId}:${window}:${signature(destinationId, window)}`;
}

function verifyCheckinToken(token, now = Date.now()) {
    if (typeof token !== 'string' || token.length > 256) return null;
    const parts = token.split(':');
    if (parts.length !== 5 || parts[0] !== TOKEN_PREFIX || parts[1] !== TOKEN_VERSION) return null;

    const [, , destinationId, windowText, suppliedSignature] = parts;
    if (!destinationId || destinationId.length > 36 || !/^\d{1,12}$/.test(windowText) || !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)) return null;
    const window = Number(windowText);
    const currentWindow = Math.floor(now / (TOKEN_WINDOW_SECONDS * 1000));
    if (!Number.isSafeInteger(window) || window < currentWindow - 1 || window > currentWindow) return null;

    const expected = Buffer.from(signature(destinationId, window));
    const provided = Buffer.from(suppliedSignature);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
    return { destinationId, expiresAt: (window + 1) * TOKEN_WINDOW_SECONDS * 1000 };
}

module.exports = { TOKEN_WINDOW_SECONDS, createCheckinToken, verifyCheckinToken };
