const db = require('../core/database');

const PRINCIPAL_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const BOOKING_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 1000;

function parseBoundedInteger(value, { defaultValue, min, max, code }) {
    if (value == null || value === '') return defaultValue;
    if (!/^\d+$/.test(String(value))) {
        const error = new Error(code);
        error.code = code;
        throw error;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
        const error = new Error(code);
        error.code = code;
        throw error;
    }
    return parsed;
}

function validateIdentifier(value, pattern, code, required = true) {
    const normalized = String(value || '').trim();
    if ((!normalized && required) || (normalized && !pattern.test(normalized))) {
        const error = new Error(code);
        error.code = code;
        throw error;
    }
    return normalized || null;
}

class AgentWorkshopBookingQueryService {
    static async listForPrincipal({ principalId, bookingReference, limit, offset, database = db }) {
        const ownerId = validateIdentifier(principalId, PRINCIPAL_ID_PATTERN, 'INVALID_PRINCIPAL_ID');
        const reference = validateIdentifier(
            bookingReference,
            BOOKING_REFERENCE_PATTERN,
            'INVALID_BOOKING_REFERENCE',
            false
        );
        const boundedLimit = parseBoundedInteger(limit, {
            defaultValue: DEFAULT_LIMIT, min: 1, max: MAX_LIMIT, code: 'INVALID_LIMIT'
        });
        const boundedOffset = parseBoundedInteger(offset, {
            defaultValue: 0, min: 0, max: MAX_OFFSET, code: 'INVALID_OFFSET'
        });

        const params = [ownerId];
        let sql = `SELECT b.id AS "bookingId", b.status, b.seats,
                          w.title AS "workshopTitle", d.name AS "destinationName",
                          ws.starts_at AS "startsAt", ws.ends_at AS "endsAt"
                   FROM workshop_session_bookings b
                   JOIN workshop_sessions ws ON ws.id = b.session_id
                   JOIN workshops w ON w.id = ws.workshop_id AND w.catalog_kind = 'workshop'
                   LEFT JOIN destinations d ON d.id = w.destination_id
                   WHERE b.user_id = $1`;
        if (reference) {
            params.push(reference);
            sql += ` AND b.id = $${params.length}`;
        }
        params.push(boundedLimit, boundedOffset);
        sql += ` ORDER BY ws.starts_at DESC, b.created_at DESC
                 LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const [rows] = await database.query(sql, params);
        return rows.map(row => ({
            bookingId: row.bookingId,
            status: row.status,
            seats: Number(row.seats),
            workshopTitle: row.workshopTitle,
            destinationName: row.destinationName ?? null,
            startsAt: row.startsAt,
            endsAt: row.endsAt
        }));
    }
}

module.exports = {
    AgentWorkshopBookingQueryService,
    BOOKING_REFERENCE_PATTERN,
    PRINCIPAL_ID_PATTERN,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    MAX_OFFSET
};
