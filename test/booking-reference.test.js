const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const db = require('../src/core/database');
const WorkshopBookingService = require('../src/services/WorkshopBookingService');
const { CommerceIntegrityService } = require('../src/services/CommerceIntegrityService');

const {
    BOOKING_REFERENCE_PATTERN,
    createBookingReference
} = require('../src/services/BookingReference');

test('booking references are short, opaque and unique across a practical sample', () => {
    const references = new Set(Array.from({ length: 1000 }, createBookingReference));
    assert.equal(references.size, 1000);
    for (const reference of references) assert.match(reference, BOOKING_REFERENCE_PATTERN);
});

test('booking creation stores and returns the staff-facing reference separately from UUID', async t => {
    const originalTransaction = db.transaction;
    const originalBegin = CommerceIntegrityService.begin;
    const originalCommit = CommerceIntegrityService.commit;
    t.after(() => {
        db.transaction = originalTransaction;
        CommerceIntegrityService.begin = originalBegin;
        CommerceIntegrityService.commit = originalCommit;
    });

    CommerceIntegrityService.begin = async () => ({ replay: false });
    let committedBody;
    CommerceIntegrityService.commit = async (...args) => { committedBody = args.at(-1); };
    let insertParams;
    db.transaction = async work => work({
        query: async (sql, params) => {
            if (sql.includes('FROM workshop_sessions ws')) {
                return [[{
                    id: 'session-1', starts_at: new Date('2026-12-31T00:00:00.000Z'),
                    ends_at: new Date('2026-12-31T02:00:00.000Z'), price_vnd: 100000,
                    capacity: 10, reserved_seats: 0, title: 'Workshop test'
                }]];
            }
            if (sql.startsWith('SELECT id FROM workshop_session_bookings')) return [[]];
            if (sql.startsWith('UPDATE workshop_sessions')) return [[]];
            if (sql.startsWith('INSERT INTO workshop_session_bookings')) {
                insertParams = params;
                return [[]];
            }
            throw new Error(`Unexpected SQL: ${sql}`);
        }
    });

    const result = await WorkshopBookingService.create({
        actor: { id: 'user-1', role: 'user', role_id: 3 },
        sessionId: 'session-1', seats: 2, idempotencyKey: 'reference-test',
        now: new Date('2026-11-27T00:00:00.000Z')
    });

    assert.match(insertParams[0], /^[0-9a-f-]{36}$/i);
    assert.match(insertParams[1], BOOKING_REFERENCE_PATTERN);
    assert.equal(result.booking.reference, insertParams[1]);
    assert.notEqual(result.booking.id, result.booking.reference);
    assert.equal(committedBody.booking.reference, result.booking.reference);
});

test('admin booking table puts the booking reference in the first column', () => {
    const view = fs.readFileSync('src/views/workshop-management/index.ejs', 'utf8');
    assert.match(view, /<thead><tr><th>Mã đặt workshop<\/th><th>Khách<\/th>/);
    assert.match(view, /booking\.booking_reference/);
    assert.doesNotMatch(view, /booking-reference[^\n]*booking\.id/);
});

test('migration backfills and uniquely indexes existing booking references', () => {
    const migration = fs.readFileSync(
        'scripts/apply_workshop_booking_reference_schema.js',
        'utf8'
    );
    assert.match(migration, /ADD COLUMN IF NOT EXISTS booking_reference/);
    assert.match(migration, /WHERE booking_reference IS NULL OR booking_reference = ''/);
    assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS ux_workshop_session_bookings_reference/);
});
