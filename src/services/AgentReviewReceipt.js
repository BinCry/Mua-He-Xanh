const crypto = require('crypto');

const RECEIPT_PREFIX = 'ar1.';
const RECEIPT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

// Tách khóa mã bàn giao khỏi mục đích ký phiên dù cùng lấy từ SESSION_SECRET.
function receiptKey(env = process.env) {
    const secret = String(env.SESSION_SECRET || '');
    if (secret.length < 32) return null;
    return crypto.createHash('sha256').update('agent-review-receipt-v1\0').update(secret).digest();
}

function createReviewReceipt({ conversationId, pauseId, kind, summary }, env = process.env) {
    const key = receiptKey(env);
    if (!key || typeof conversationId !== 'string' || typeof pauseId !== 'string') return null;
    if (!IDENTIFIER_PATTERN.test(conversationId) || !IDENTIFIER_PATTERN.test(pauseId)) return null;
    if (!['approval', 'handoff'].includes(kind)) return null;
    if (typeof summary !== 'string' || !summary.trim() || summary.length > 500) return null;
    const payload = JSON.stringify({
        conversationId,
        pauseId,
        kind,
        summary,
        expiresAt: Date.now() + RECEIPT_LIFETIME_MS
    });
    const iv = crypto.randomBytes(12);
    // AES-GCM giữ kín ID hội thoại và phát hiện mọi chỉnh sửa mã do khách chuyển cho admin.
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
    const receipt = RECEIPT_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
    return receipt.length <= 1600 ? receipt : null;
}

function readReviewReceipt(value, env = process.env) {
    const key = receiptKey(env);
    if (!key || typeof value !== 'string' || !/^ar1\.[A-Za-z0-9_-]{40,1800}$/.test(value)) return null;
    try {
        const data = Buffer.from(value.slice(RECEIPT_PREFIX.length), 'base64url');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12));
        decipher.setAuthTag(data.subarray(12, 28));
        const payload = JSON.parse(Buffer.concat([
            decipher.update(data.subarray(28)), decipher.final()
        ]).toString('utf8'));
        if (typeof payload.conversationId !== 'string' || typeof payload.pauseId !== 'string') return null;
        if (!IDENTIFIER_PATTERN.test(payload.conversationId) || !IDENTIFIER_PATTERN.test(payload.pauseId)) return null;
        if (!['approval', 'handoff'].includes(payload.kind)) return null;
        if (typeof payload.summary !== 'string' || !payload.summary.trim() || payload.summary.length > 500) return null;
        if (!Number.isSafeInteger(payload.expiresAt) || payload.expiresAt <= Date.now()) return null;
        return payload;
    } catch (_) {
        return null;
    }
}

module.exports = { createReviewReceipt, readReviewReceipt };
