const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const { CommerceIntegrityService } = require('./CommerceIntegrityService');

function domainError(code) {
    const error = new Error(code);
    error.code = code;
    return error;
}

class WorkshopBookingService {
    static async create({ userId, sessionId, seats, idempotencyKey, now = new Date() }) {
        if (!Number.isSafeInteger(seats) || seats < 1 || seats > 100) throw domainError('INVALID_SEAT_COUNT');

        return db.transaction(async tx => {
            const idempotency = await CommerceIntegrityService.begin(
                tx,
                userId,
                'workshop-booking.create',
                idempotencyKey,
                { sessionId, seats }
            );
            if (idempotency.replay) return { replay: true, ...idempotency.body };

            const [sessions] = await tx.query(
                'SELECT ws.id, ws.starts_at, ws.ends_at, ws.price_vnd, ws.capacity, ws.reserved_seats, w.title ' +
                'FROM workshop_sessions ws JOIN workshops w ON w.id = ws.workshop_id ' +
                'WHERE ws.id = $1 AND ws.is_active = TRUE AND w.is_active = 1 FOR UPDATE',
                [sessionId]
            );
            const session = sessions[0];
            if (!session) throw domainError('WORKSHOP_SESSION_UNAVAILABLE');
            if (new Date(session.starts_at) <= now) throw domainError('WORKSHOP_SESSION_ALREADY_STARTED');
            if (Number(session.capacity) - Number(session.reserved_seats) < seats) {
                throw domainError('INSUFFICIENT_WORKSHOP_SEATS');
            }

            const booking = {
                id: uuidv4(),
                userId,
                sessionId: session.id,
                seats,
                title: session.title,
                price: Number(session.price_vnd)
            };
            await tx.query(
                'UPDATE workshop_sessions SET reserved_seats = reserved_seats + $1, updated_at = NOW() WHERE id = $2',
                [seats, session.id]
            );
            await tx.query(
                'INSERT INTO workshop_session_bookings (id, user_id, session_id, seats, title_snapshot, price_vnd_snapshot, status, idempotency_key) ' +
                'VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [booking.id, userId, session.id, seats, booking.title, booking.price, 'pending', idempotencyKey]
            );
            const body = {
                success: true,
                booking: {
                    id: booking.id,
                    status: 'pending',
                    seats: booking.seats,
                    totalVnd: booking.price * booking.seats
                }
            };
            await CommerceIntegrityService.commit(tx, userId, 'workshop-booking.create', idempotencyKey, 201, body);
            return { replay: false, ...body };
        });
    }
}

module.exports = WorkshopBookingService;
