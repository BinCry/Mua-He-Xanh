-- Run against a backup-backed staging database first.
-- Do not wrap this file in a transaction because PostgreSQL CREATE INDEX CONCURRENTLY
-- must run outside a transaction block.

CREATE TABLE IF NOT EXISTS workshop_bookings (
    id VARCHAR(36) PRIMARY KEY,
    workshop_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    booking_date DATE NOT NULL,
    booking_time VARCHAR(32),
    num_people INTEGER NOT NULL DEFAULT 1,
    total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    qr_ticket VARCHAR(128),
    note TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    rating INTEGER,
    review TEXT,
    points_awarded SMALLINT NOT NULL DEFAULT 1,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE workshop_bookings
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128),
    ADD COLUMN IF NOT EXISTS points_awarded SMALLINT DEFAULT 1;

-- Existing bookings received 50 points at creation in the old implementation.
-- Preserve their already-accounted state; new requests explicitly start at zero.
UPDATE workshop_bookings SET points_awarded = 1 WHERE points_awarded IS NULL;
ALTER TABLE workshop_bookings ALTER COLUMN points_awarded SET DEFAULT 1;
ALTER TABLE workshop_bookings ALTER COLUMN points_awarded SET NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS workshop_bookings_user_idempotency_uidx
    ON workshop_bookings (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS festival_bookings (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36),
    festival_id VARCHAR(36) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    tickets INTEGER NOT NULL CHECK (tickets BETWEEN 1 AND 20),
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    reference_code VARCHAR(32),
    idempotency_key VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE festival_bookings
    ADD COLUMN IF NOT EXISTS reference_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS festival_bookings_reference_code_uidx
    ON festival_bookings (reference_code)
    WHERE reference_code IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS festival_bookings_idempotency_uidx
    ON festival_bookings (idempotency_key)
    WHERE idempotency_key IS NOT NULL;
