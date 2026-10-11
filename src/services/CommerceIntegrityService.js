const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

function payloadHash(payload) {
    return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

class IdempotencyConflictError extends Error {
    constructor() {
        super('IDEMPOTENCY_PAYLOAD_CONFLICT');
        this.code = 'IDEMPOTENCY_PAYLOAD_CONFLICT';
    }
}

class CommerceIntegrityService {
    static requireKey(key) {
        if (typeof key !== 'string' || key.length < 8 || key.length > 200) {
            const error = new Error('IDEMPOTENCY_KEY_REQUIRED');
            error.code = 'IDEMPOTENCY_KEY_REQUIRED';
            throw error;
        }
    }

    static async begin(tx, userId, operation, key, payload) {
        this.requireKey(key);
        const hash = payloadHash(payload);
        const [existing] = await tx.query(
            'SELECT payload_hash, response_status, response_body FROM idempotency_keys WHERE user_id = $1 AND operation = $2 AND key = $3 FOR UPDATE',
            [userId, operation, key]
        );
        if (existing.length) {
            if (existing[0].payload_hash !== hash) throw new IdempotencyConflictError();
            if (existing[0].response_status) return { replay: true, status: existing[0].response_status, body: existing[0].response_body };
            const error = new Error('IDEMPOTENCY_IN_PROGRESS');
            error.code = 'IDEMPOTENCY_IN_PROGRESS';
            throw error;
        }
        await tx.query(
            'INSERT INTO idempotency_keys (user_id, operation, key, payload_hash) VALUES ($1, $2, $3, $4)',
            [userId, operation, key, hash]
        );
        return { replay: false };
    }

    static async commit(tx, userId, operation, key, status, body) {
        await tx.query(
            'UPDATE idempotency_keys SET response_status = $1, response_body = $2::jsonb, committed_at = NOW() WHERE user_id = $3 AND operation = $4 AND key = $5',
            [status, JSON.stringify(body), userId, operation, key]
        );
    }

    static async awardPoints(tx, userId, delta, reason, referenceType, referenceId) {
        const [entries] = await tx.query(
            'INSERT INTO point_ledger (id, user_id, delta, reason, reference_type, reference_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id, reason, reference_type, reference_id) DO NOTHING RETURNING id',
            [uuidv4(), userId, delta, reason, referenceType, referenceId]
        );
        if (!entries.length) return false;
        await tx.query('UPDATE users SET total_points = COALESCE(total_points, 0) + $1 WHERE id = $2', [delta, userId]);
        return true;
    }
}

module.exports = { CommerceIntegrityService, IdempotencyConflictError, payloadHash };
