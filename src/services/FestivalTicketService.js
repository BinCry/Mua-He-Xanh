const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../core/database');
const { CommerceIntegrityService } = require('./CommerceIntegrityService');

function domainError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

function createCode() {
    return 'BLF-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

class FestivalTicketService {
    static async create({ userId, festivalId, count, idempotencyKey }) {
        if (!userId) throw domainError('AUTHENTICATION_REQUIRED');
        if (!Number.isSafeInteger(count) || count < 1 || count > 10) throw domainError('INVALID_TICKET_COUNT');

        return db.transaction(async tx => {
            const idempotency = await CommerceIntegrityService.begin(
                tx, userId, 'festival-ticket.create', idempotencyKey, { festivalId, count }
            );
            if (idempotency.replay) return { replay: true, ...idempotency.body };
            const [festivals] = await tx.query(
                "SELECT id, name, capacity, registration_open FROM festivals WHERE id = $1 AND COALESCE(status, 'upcoming') <> 'draft' FOR UPDATE",
                [festivalId]
            );
            const festival = festivals[0];
            if (!festival) throw domainError('FESTIVAL_UNAVAILABLE');
            if (festival.registration_open === false) throw domainError('FESTIVAL_REGISTRATION_CLOSED');
            if (festival.capacity !== null && festival.capacity !== undefined) {
                const [counts] = await tx.query(
                    "SELECT COUNT(*) AS total FROM festival_tickets WHERE festival_id = $1 AND status = 'active'",
                    [festival.id]
                );
                if (Number(counts[0]?.total || 0) + count > Number(festival.capacity)) {
                    throw domainError('FESTIVAL_CAPACITY_FULL');
                }
            }

            const tickets = [];
            for (let index = 0; index < count; index += 1) {
                const ticket = { id: uuidv4(), code: createCode() };
                await tx.query(
                    'INSERT INTO festival_tickets (id, user_id, festival_id, ticket_code, status) VALUES ($1, $2, $3, $4, $5)',
                    [ticket.id, userId, festival.id, ticket.code, 'active']
                );
                tickets.push(ticket);
            }
            const body = {
                success: true,
                festival: { id: festival.id, name: festival.name },
                tickets: tickets.map(ticket => ({ id: ticket.id, code: ticket.code, status: 'active' }))
            };
            await CommerceIntegrityService.commit(tx, userId, 'festival-ticket.create', idempotencyKey, 201, body);
            return { replay: false, ...body };
        });
    }

    static async cancel({ userId, ticketId, idempotencyKey }) {
        if (!userId) throw domainError('AUTHENTICATION_REQUIRED');
        return db.transaction(async tx => {
            const idempotency = await CommerceIntegrityService.begin(
                tx, userId, 'festival-ticket.cancel', idempotencyKey, { ticketId }
            );
            if (idempotency.replay) return { replay: true, ...idempotency.body };
            const [tickets] = await tx.query(
                'SELECT id, user_id, status FROM festival_tickets WHERE id = $1 FOR UPDATE',
                [ticketId]
            );
            const ticket = tickets[0];
            if (!ticket) throw domainError('FESTIVAL_TICKET_NOT_FOUND');
            if (String(ticket.user_id) !== String(userId)) throw domainError('FESTIVAL_TICKET_FORBIDDEN');
            if (ticket.status !== 'active') throw domainError('FESTIVAL_TICKET_STATE_CONFLICT');
            const [updated] = await tx.query(
                "UPDATE festival_tickets SET status = 'cancelled' WHERE id = $1 AND status = 'active' RETURNING id, status",
                [ticket.id]
            );
            if (!updated.length) throw domainError('FESTIVAL_TICKET_STATE_CONFLICT');
            const body = { success: true, id: ticket.id, status: 'cancelled' };
            await CommerceIntegrityService.commit(tx, userId, 'festival-ticket.cancel', idempotencyKey, 200, body);
            return { replay: false, ...body };
        });
    }

    static async use({ actor, ticketId, idempotencyKey }) {
        const isAdmin = actor && (actor.role === 'admin' || Number(actor.role_id) === 1);
        if (!isAdmin) throw domainError('FESTIVAL_TICKET_FORBIDDEN');
        return db.transaction(async tx => {
            const idempotency = await CommerceIntegrityService.begin(
                tx, actor.id, 'festival-ticket.use', idempotencyKey, { ticketId }
            );
            if (idempotency.replay) return { replay: true, ...idempotency.body };
            const [tickets] = await tx.query('SELECT id, status FROM festival_tickets WHERE id = $1 FOR UPDATE', [ticketId]);
            const ticket = tickets[0];
            if (!ticket) throw domainError('FESTIVAL_TICKET_NOT_FOUND');
            if (ticket.status !== 'active') throw domainError('FESTIVAL_TICKET_STATE_CONFLICT');
            const [updated] = await tx.query(
                "UPDATE festival_tickets SET status = 'used', used_at = NOW() WHERE id = $1 AND status = 'active' RETURNING id, status, used_at",
                [ticket.id]
            );
            if (!updated.length) throw domainError('FESTIVAL_TICKET_STATE_CONFLICT');
            const body = { success: true, id: ticket.id, status: 'used' };
            await CommerceIntegrityService.commit(tx, actor.id, 'festival-ticket.use', idempotencyKey, 200, body);
            return { replay: false, ...body };
        });
    }
}

module.exports = FestivalTicketService;
