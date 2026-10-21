const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/core/database');
const WorkshopBookingService = require('../src/services/WorkshopBookingService');
const CommerceTransitionService = require('../src/services/CommerceTransitionService');
const { CommerceIntegrityService } = require('../src/services/CommerceIntegrityService');
const { WorkshopManagementService } = require('../src/services/WorkshopManagementService');

function affectedRows(count = 1) {
    const rows = [];
    rows.rowCount = count;
    rows.affectedRows = count;
    return rows;
}

test('only tourist accounts can create Workshop bookings', async () => {
    await assert.rejects(
        WorkshopBookingService.create({
            actor: { id: 'manager-1', role: 'manager', role_id: 2 },
            sessionId: 'session-1', seats: 1, idempotencyKey: 'manager-booking-attempt'
        }),
        error => error.code === 'WORKSHOP_BOOKING_FORBIDDEN'
    );
    await assert.rejects(
        WorkshopBookingService.create({
            actor: null, sessionId: 'session-1', seats: 1, idempotencyKey: 'anonymous-booking-attempt'
        }),
        error => error.code === 'AUTHENTICATION_REQUIRED'
    );
});

test('a tourist cannot hold two active bookings for the same Workshop session', async t => {
    const originalTransaction = db.transaction;
    const originalBegin = CommerceIntegrityService.begin;
    const originalCommit = CommerceIntegrityService.commit;
    t.after(() => {
        db.transaction = originalTransaction;
        CommerceIntegrityService.begin = originalBegin;
        CommerceIntegrityService.commit = originalCommit;
    });
    CommerceIntegrityService.begin = async () => ({ replay: false });
    CommerceIntegrityService.commit = async () => {};
    db.transaction = async work => work({
        query: async (sql) => {
            if (sql.includes('FROM workshop_sessions ws')) {
                return [[{
                    id: 'session-1', starts_at: new Date('2026-11-01T00:00:00.000Z'),
                    ends_at: new Date('2026-11-01T02:00:00.000Z'), price_vnd: 0,
                    capacity: 10, reserved_seats: 1, title: 'Workshop'
                }]];
            }
            if (sql.startsWith('SELECT id FROM workshop_session_bookings')) return [[{ id: 'booking-existing' }]];
            throw new Error(`Unexpected SQL: ${sql}`);
        }
    });

    await assert.rejects(
        WorkshopBookingService.create({
            actor: { id: 'user-1', role: 'user', role_id: 3 },
            sessionId: 'session-1', seats: 1, idempotencyKey: 'second-booking-attempt',
            now: new Date('2026-10-21T00:00:00.000Z')
        }),
        error => error.code === 'WORKSHOP_ALREADY_BOOKED'
    );
});

test('a started Workshop session can be closed without rewriting its immutable details', async t => {
    const originalTransaction = db.transaction;
    t.after(() => { db.transaction = originalTransaction; });

    const startsAt = new Date('2026-10-19T00:00:00.000Z');
    const endsAt = new Date('2026-10-19T02:00:00.000Z');
    let updatedParams = null;
    db.transaction = async work => work({
        query: async (sql, params) => {
            if (sql.startsWith('SELECT ws.*')) {
                return [[{
                    id: 'session-1', workshop_id: 'workshop-1', destination_id: 'destination-1',
                    catalog_kind: 'workshop', starts_at: startsAt, ends_at: endsAt,
                    price_vnd: 0, capacity: 10, reserved_seats: 1, is_active: true
                }]];
            }
            if (sql.startsWith('UPDATE workshop_sessions')) {
                updatedParams = params;
                return [affectedRows()];
            }
            throw new Error(`Unexpected SQL: ${sql}`);
        }
    });

    const result = await WorkshopManagementService.updateSession({
        actor: { id: 'admin-1', role: 'admin', role_id: 1 }, sessionId: 'session-1',
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
        priceVnd: 0, capacity: 10, isActive: false,
        now: new Date('2026-10-21T00:00:00.000Z')
    });

    assert.equal(result.session.isActive, false);
    assert.equal(updatedParams[4], false);
});

test('a started Workshop session cannot be reopened or have schedule details rewritten', async t => {
    const originalTransaction = db.transaction;
    t.after(() => { db.transaction = originalTransaction; });

    const startsAt = new Date('2026-10-19T00:00:00.000Z');
    const endsAt = new Date('2026-10-19T02:00:00.000Z');
    db.transaction = async work => work({
        query: async sql => {
            if (sql.startsWith('SELECT ws.*')) {
                return [[{
                    id: 'session-1', workshop_id: 'workshop-1', destination_id: 'destination-1',
                    catalog_kind: 'workshop', starts_at: startsAt, ends_at: endsAt,
                    price_vnd: 0, capacity: 10, reserved_seats: 1, is_active: true
                }]];
            }
            throw new Error(`Unexpected SQL: ${sql}`);
        }
    });

    const base = {
        actor: { id: 'admin-1', role: 'admin', role_id: 1 }, sessionId: 'session-1',
        startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
        priceVnd: 0, capacity: 10, now: new Date('2026-10-21T00:00:00.000Z')
    };
    await assert.rejects(
        WorkshopManagementService.updateSession({ ...base, isActive: true }),
        error => error.code === 'WORKSHOP_SESSION_ALREADY_STARTED'
    );
    await assert.rejects(
        WorkshopManagementService.updateSession({ ...base, endsAt: '2026-10-19T03:00:00.000Z', isActive: false }),
        error => error.code === 'WORKSHOP_SESSION_LOCKED'
    );
});

test('a tourist cannot self-cancel after start, while destination staff can resolve the booking', async t => {
    const originalTransaction = db.transaction;
    const originalBegin = CommerceIntegrityService.begin;
    const originalCommit = CommerceIntegrityService.commit;
    t.after(() => {
        db.transaction = originalTransaction;
        CommerceIntegrityService.begin = originalBegin;
        CommerceIntegrityService.commit = originalCommit;
    });
    CommerceIntegrityService.begin = async () => ({ replay: false });
    CommerceIntegrityService.commit = async () => {};

    const record = {
        id: 'booking-1', user_id: 'user-1', session_id: 'session-1', quantity: 1,
        status: 'confirmed', destination_id: 'destination-1',
        starts_at: new Date('2026-10-19T00:00:00.000Z'),
        ends_at: new Date('2026-10-19T02:00:00.000Z'), reserved_seats: 1
    };
    db.transaction = async work => work({
        query: async (sql, params) => {
            if (sql.startsWith('SELECT b.id')) return [[record]];
            if (sql.startsWith('UPDATE workshop_sessions')) return [affectedRows()];
            if (sql.startsWith('UPDATE workshop_session_bookings')) {
                return [[{ id: record.id, user_id: record.user_id, status: params[0] }]];
            }
            throw new Error(`Unexpected SQL: ${sql}`);
        }
    });

    await assert.rejects(
        CommerceTransitionService.transitionWorkshop({
            actor: { id: 'user-1', role: 'user', role_id: 3 }, bookingId: record.id,
            targetStatus: 'cancelled', idempotencyKey: 'late-tourist-cancel',
            now: new Date('2026-10-21T00:00:00.000Z')
        }),
        error => error.code === 'WORKSHOP_CANCELLATION_CLOSED'
    );

    const result = await CommerceTransitionService.transitionWorkshop({
        actor: { id: 'manager-1', role: 'manager', role_id: 2, managed_destination_id: 'destination-1' },
        bookingId: record.id, targetStatus: 'cancelled', idempotencyKey: 'staff-late-cancel',
        now: new Date('2026-10-21T00:00:00.000Z')
    });
    assert.equal(result.status, 'cancelled');
});
