const { v4: uuidv4 } = require('uuid');
const db = require('../core/database');
const { CommerceIntegrityService } = require('./CommerceIntegrityService');

function domainError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

function isAdmin(actor) {
    return actor && (actor.role === 'admin' || Number(actor.role_id) === 1);
}

function isManager(actor) {
    return isAdmin(actor) || (actor && (actor.role === 'manager' || Number(actor.role_id) === 2));
}

function requiredText(value, maxLength, code) {
    const text = String(value || '').trim();
    if (!text || text.length > maxLength) throw domainError(code);
    return text;
}

function nonNegativeMoney(value) {
    const money = Number(value);
    if (!Number.isSafeInteger(money) || money < 0 || money > 10_000_000_000) {
        throw domainError('INVALID_WORKSHOP_PRICE');
    }
    return money;
}

function positiveCapacity(value) {
    const capacity = Number(value);
    if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10_000) {
        throw domainError('INVALID_WORKSHOP_CAPACITY');
    }
    return capacity;
}

// A datetime-local input has no zone. Treat it as the operational timezone,
// never as the server's timezone, before storing TIMESTAMPTZ in PostgreSQL.
function parseHoChiMinhDateTime(value) {
    const raw = String(value || '').trim();
    if (!raw) throw domainError('INVALID_WORKSHOP_TIME');
    const normalized = /(?:Z|[+-]\d\d:\d\d)$/.test(raw)
        ? raw
        : raw.replace(' ', 'T') + (raw.length === 16 ? ':00' : '') + '+07:00';
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) throw domainError('INVALID_WORKSHOP_TIME');
    return date;
}

function assertSchedule(startsAt, endsAt, now = new Date()) {
    if (startsAt <= now || endsAt <= startsAt) throw domainError('INVALID_WORKSHOP_TIME');
}

function sameInstant(left, right) {
    return Math.floor(new Date(left).getTime() / 1000) === Math.floor(new Date(right).getTime() / 1000);
}

async function lockedWorkshop(tx, workshopId) {
    const [rows] = await tx.query(
        "SELECT id, destination_id, catalog_kind, is_active FROM workshops WHERE id = $1 FOR UPDATE",
        [workshopId]
    );
    return rows[0] || null;
}

function assertScope(actor, workshop) {
    if (!isManager(actor)) throw domainError('WORKSHOP_MANAGEMENT_FORBIDDEN');
    if (!workshop || workshop.catalog_kind !== 'workshop') throw domainError('WORKSHOP_NOT_FOUND');
    if (!isAdmin(actor) && String(actor.managed_destination_id || '') !== String(workshop.destination_id)) {
        throw domainError('WORKSHOP_MANAGEMENT_FORBIDDEN');
    }
}

class WorkshopManagementService {
    static async createWorkshop({ actor, destinationId, title, description, idempotencyKey }) {
        if (!isManager(actor)) throw domainError('WORKSHOP_MANAGEMENT_FORBIDDEN');
        const resolvedDestinationId = isAdmin(actor)
            ? requiredText(destinationId, 36, 'WORKSHOP_DESTINATION_REQUIRED')
            : requiredText(actor.managed_destination_id, 36, 'WORKSHOP_DESTINATION_REQUIRED');
        const safeTitle = requiredText(title, 200, 'INVALID_WORKSHOP_TITLE');
        const safeDescription = String(description || '').trim();
        if (safeDescription.length > 10_000) throw domainError('INVALID_WORKSHOP_DESCRIPTION');

        return db.transaction(async tx => {
            const idem = await CommerceIntegrityService.begin(
                tx, actor.id, 'workshop.manage.create', idempotencyKey,
                { destinationId: resolvedDestinationId, title: safeTitle, description: safeDescription }
            );
            if (idem.replay) return { replay: true, ...idem.body };
            const [destinations] = await tx.query(
                'SELECT id FROM destinations WHERE id = $1 AND is_active = 1 FOR UPDATE',
                [resolvedDestinationId]
            );
            if (!destinations.length) throw domainError('WORKSHOP_DESTINATION_UNAVAILABLE');
            const workshop = { id: uuidv4(), destinationId: resolvedDestinationId, title: safeTitle, description: safeDescription };
            await tx.query(
                "INSERT INTO workshops (id, destination_id, title, description, is_active, catalog_kind, created_at) VALUES ($1, $2, $3, $4, 1, 'workshop', NOW())",
                [workshop.id, workshop.destinationId, workshop.title, workshop.description]
            );
            const body = { success: true, workshop };
            await CommerceIntegrityService.commit(tx, actor.id, 'workshop.manage.create', idempotencyKey, 201, body);
            return { replay: false, ...body };
        });
    }

    static async updateWorkshop({ actor, workshopId, title, description, isActive }) {
        const safeTitle = requiredText(title, 200, 'INVALID_WORKSHOP_TITLE');
        const safeDescription = String(description || '').trim();
        if (safeDescription.length > 10_000) throw domainError('INVALID_WORKSHOP_DESCRIPTION');
        if (typeof isActive !== 'boolean') throw domainError('INVALID_WORKSHOP_STATUS');

        return db.transaction(async tx => {
            const workshop = await lockedWorkshop(tx, workshopId);
            assertScope(actor, workshop);
            if (isActive) {
                const [destinations] = await tx.query(
                    'SELECT id FROM destinations WHERE id = $1 AND is_active = 1 FOR UPDATE',
                    [workshop.destination_id]
                );
                if (!destinations.length) throw domainError('WORKSHOP_DESTINATION_UNAVAILABLE');
            }
            await tx.query(
                'UPDATE workshops SET title = $1, description = $2, is_active = $3 WHERE id = $4',
                [safeTitle, safeDescription, isActive ? 1 : 0, workshopId]
            );
            return { success: true, workshop: { id: workshopId, title: safeTitle, description: safeDescription, isActive } };
        });
    }

    static async createSession({ actor, workshopId, startsAt, endsAt, priceVnd, capacity, idempotencyKey, now = new Date() }) {
        const start = parseHoChiMinhDateTime(startsAt);
        const end = parseHoChiMinhDateTime(endsAt);
        assertSchedule(start, end, now);
        const price = nonNegativeMoney(priceVnd);
        const seats = positiveCapacity(capacity);
        return db.transaction(async tx => {
            const workshop = await lockedWorkshop(tx, workshopId);
            assertScope(actor, workshop);
            if (!workshop.is_active) throw domainError('WORKSHOP_UNAVAILABLE');
            const [destinations] = await tx.query(
                'SELECT id FROM destinations WHERE id = $1 AND is_active = 1 FOR UPDATE',
                [workshop.destination_id]
            );
            if (!destinations.length) throw domainError('WORKSHOP_DESTINATION_UNAVAILABLE');
            const idem = await CommerceIntegrityService.begin(
                tx, actor.id, 'workshop.session.create', idempotencyKey,
                { workshopId, startsAt: start.toISOString(), endsAt: end.toISOString(), priceVnd: price, capacity: seats }
            );
            if (idem.replay) return { replay: true, ...idem.body };
            const session = { id: uuidv4(), workshopId, startsAt: start, endsAt: end, priceVnd: price, capacity: seats };
            await tx.query(
                'INSERT INTO workshop_sessions (id, workshop_id, starts_at, ends_at, price_vnd, capacity, reserved_seats, is_active) VALUES ($1, $2, $3, $4, $5, $6, 0, TRUE)',
                [session.id, session.workshopId, session.startsAt, session.endsAt, session.priceVnd, session.capacity]
            );
            const body = { success: true, session: { ...session, startsAt: start.toISOString(), endsAt: end.toISOString(), reservedSeats: 0, isActive: true } };
            await CommerceIntegrityService.commit(tx, actor.id, 'workshop.session.create', idempotencyKey, 201, body);
            return { replay: false, ...body };
        });
    }

    static async updateSession({ actor, sessionId, startsAt, endsAt, priceVnd, capacity, isActive, now = new Date() }) {
        if (typeof isActive !== 'boolean') throw domainError('INVALID_WORKSHOP_STATUS');
        return db.transaction(async tx => {
            const [sessions] = await tx.query(
                'SELECT ws.*, w.destination_id, w.catalog_kind, w.is_active AS workshop_active FROM workshop_sessions ws JOIN workshops w ON w.id = ws.workshop_id WHERE ws.id = $1 FOR UPDATE',
                [sessionId]
            );
            const session = sessions[0];
            assertScope(actor, session && { id: session.workshop_id, destination_id: session.destination_id, catalog_kind: session.catalog_kind });

            const start = parseHoChiMinhDateTime(startsAt);
            const end = parseHoChiMinhDateTime(endsAt);
            const price = nonNegativeMoney(priceVnd);
            const seats = positiveCapacity(capacity);
            if (end <= start) throw domainError('INVALID_WORKSHOP_TIME');

            const hasStarted = new Date(session.starts_at) <= now;
            const immutableDetailsChanged = !sameInstant(start, session.starts_at) ||
                !sameInstant(end, session.ends_at) ||
                price !== Number(session.price_vnd) ||
                seats !== Number(session.capacity);
            if (hasStarted) {
                if (immutableDetailsChanged) throw domainError('WORKSHOP_SESSION_LOCKED');
                if (isActive) throw domainError('WORKSHOP_SESSION_ALREADY_STARTED');
            } else {
                assertSchedule(start, end, now);
            }
            if (isActive) {
                if (!session.workshop_active) throw domainError('WORKSHOP_UNAVAILABLE');
                const [destinations] = await tx.query(
                    'SELECT id FROM destinations WHERE id = $1 AND is_active = 1 FOR UPDATE',
                    [session.destination_id]
                );
                if (!destinations.length) throw domainError('WORKSHOP_DESTINATION_UNAVAILABLE');
            }
            if (seats < Number(session.reserved_seats)) throw domainError('WORKSHOP_CAPACITY_BELOW_RESERVED');
            await tx.query(
                'UPDATE workshop_sessions SET starts_at = $1, ends_at = $2, price_vnd = $3, capacity = $4, is_active = $5, updated_at = NOW() WHERE id = $6',
                [start, end, price, seats, isActive, sessionId]
            );
            return { success: true, session: { id: sessionId, startsAt: start.toISOString(), endsAt: end.toISOString(), priceVnd: price, capacity: seats, isActive } };
        });
    }
}

module.exports = { WorkshopManagementService, parseHoChiMinhDateTime, sameInstant };
