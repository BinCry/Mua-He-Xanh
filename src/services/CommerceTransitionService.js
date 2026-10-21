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

function validTransition(from, target) {
    return (from === 'pending' && (target === 'confirmed' || target === 'cancelled')) ||
        (from === 'confirmed' && (target === 'completed' || target === 'cancelled'));
}

class CommerceTransitionService {
    static async transitionProduct({ actor, orderId, targetStatus, idempotencyKey }) {
        return this._transition({
            actor, recordId: orderId, targetStatus, idempotencyKey,
            operation: 'product-order.transition',
            select: 'SELECT o.id, o.user_id, o.product_id, o.quantity, o.status, p.destination_id, p.stock_on_hand, p.reserved_stock ' +
                'FROM product_orders o JOIN products p ON p.id = o.product_id WHERE o.id = $1 FOR UPDATE',
            complete: async (tx, record) => tx.query(
                'UPDATE products SET stock_on_hand = stock_on_hand - $1, reserved_stock = reserved_stock - $1, updated_at = NOW() ' +
                'WHERE id = $2 AND stock_on_hand >= $1 AND reserved_stock >= $1',
                [record.quantity, record.product_id]
            ),
            cancel: async (tx, record) => tx.query(
                'UPDATE products SET reserved_stock = reserved_stock - $1, updated_at = NOW() WHERE id = $2 AND reserved_stock >= $1',
                [record.quantity, record.product_id]
            ),
            referenceType: 'product-order'
        });
    }

    static async transitionWorkshop({ actor, bookingId, targetStatus, idempotencyKey, now = new Date() }) {
        return this._transition({
            actor, recordId: bookingId, targetStatus, idempotencyKey,
            operation: 'workshop-booking.transition',
            select: 'SELECT b.id, b.user_id, b.session_id, b.seats AS quantity, b.status, w.destination_id, ws.starts_at, ws.ends_at, ws.reserved_seats ' +
                'FROM workshop_session_bookings b JOIN workshop_sessions ws ON ws.id = b.session_id ' +
                "JOIN workshops w ON w.id = ws.workshop_id WHERE b.id = $1 AND w.catalog_kind = 'workshop' FOR UPDATE",
            cancelOwnerGuard: record => {
                if (new Date(record.starts_at) <= now) throw domainError('WORKSHOP_CANCELLATION_CLOSED');
            },
            complete: async (tx, record) => {
                if (new Date(record.ends_at) > now) throw domainError('WORKSHOP_SESSION_NOT_FINISHED');
                return tx.query(
                    'UPDATE workshop_sessions SET reserved_seats = reserved_seats - $1, updated_at = NOW() ' +
                    'WHERE id = $2 AND reserved_seats >= $1',
                    [record.quantity, record.session_id]
                );
            },
            cancel: async (tx, record) => tx.query(
                'UPDATE workshop_sessions SET reserved_seats = reserved_seats - $1, updated_at = NOW() ' +
                'WHERE id = $2 AND reserved_seats >= $1',
                [record.quantity, record.session_id]
            ),
            referenceType: 'workshop-booking'
        });
    }

    static async _transition({ actor, recordId, targetStatus, idempotencyKey, operation, select, complete, cancel, cancelOwnerGuard, referenceType }) {
        if (!actor || !actor.id) throw domainError('AUTHENTICATION_REQUIRED');
        if (!['confirmed', 'completed', 'cancelled'].includes(targetStatus)) throw domainError('INVALID_STATUS_TRANSITION');

        return db.transaction(async tx => {
            const idempotency = await CommerceIntegrityService.begin(
                tx, actor.id, operation, idempotencyKey, { recordId, targetStatus }
            );
            if (idempotency.replay) return { replay: true, ...idempotency.body };

            const [records] = await tx.query(select, [recordId]);
            const record = records[0];
            if (!record) throw domainError('COMMERCE_RECORD_NOT_FOUND');
            const ownsRecord = String(record.user_id) === String(actor.id);
            const ownsDestination = isAdmin(actor) || (isManager(actor) &&
                actor.managed_destination_id && String(actor.managed_destination_id) === String(record.destination_id));
            if (targetStatus === 'cancelled') {
                if (!ownsRecord && !ownsDestination) throw domainError('COMMERCE_RECORD_FORBIDDEN');
                if (ownsRecord && !ownsDestination && cancelOwnerGuard) cancelOwnerGuard(record);
            } else if (!ownsDestination) {
                throw domainError('COMMERCE_RECORD_FORBIDDEN');
            }
            if (!validTransition(record.status, targetStatus)) throw domainError('INVALID_STATUS_TRANSITION');

            if (targetStatus === 'completed') {
                const result = await complete(tx, record);
                if (result[0].rowCount !== 1) throw domainError('COMMERCE_RESERVATION_INCONSISTENT');
            } else if (targetStatus === 'cancelled') {
                const result = await cancel(tx, record);
                if (result[0].rowCount !== 1) throw domainError('COMMERCE_RESERVATION_INCONSISTENT');
            }

            const table = referenceType === 'product-order' ? 'product_orders' : 'workshop_session_bookings';
            const [updated] = await tx.query(
                "UPDATE " + table + " SET status = $1, confirmed_at = CASE WHEN $1 = 'confirmed' THEN NOW() ELSE confirmed_at END, " +
                "completed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE completed_at END, " +
                "cancelled_at = CASE WHEN $1 = 'cancelled' THEN NOW() ELSE cancelled_at END " +
                "WHERE id = $2 AND status = $3 RETURNING id, user_id, status",
                [targetStatus, record.id, record.status]
            );
            if (!updated.length) throw domainError('COMMERCE_STATE_CONFLICT');
            if (targetStatus === 'completed') {
                await CommerceIntegrityService.awardPoints(tx, record.user_id, 50, 'completion', referenceType, record.id);
            }

            const body = { success: true, id: record.id, status: targetStatus };
            await CommerceIntegrityService.commit(tx, actor.id, operation, idempotencyKey, 200, body);
            return { replay: false, ...body };
        });
    }
}

module.exports = CommerceTransitionService;
