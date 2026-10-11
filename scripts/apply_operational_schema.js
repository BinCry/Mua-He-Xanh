#!/usr/bin/env node
/*
 * Explicit operational schema migration. Never invoked at application startup.
 * Run with --dry-run first, then against a backed-up database only.
 */
const crypto = require('crypto');
const { Pool } = require('pg');

const connectionString = String(process.env.DATABASE_URL || '').trim();
const dryRun = process.argv.includes('--dry-run');
if (!connectionString) throw new Error('DATABASE_URL is required.');

const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(connectionString);
// Verify certificates by default. A self-signed deployment must opt in
// explicitly through DATABASE_SSL_REJECT_UNAUTHORIZED=false.
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
});
const migrationId = '20261011_operational_domains_v1';
const statements = [
  'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  'CREATE TABLE IF NOT EXISTS products (id VARCHAR(36) PRIMARY KEY, destination_id VARCHAR(36) NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT \'\', price_vnd BIGINT NOT NULL CHECK (price_vnd >= 0), stock_on_hand INT NOT NULL CHECK (stock_on_hand >= 0), reserved_stock INT NOT NULL DEFAULT 0 CHECK (reserved_stock >= 0 AND reserved_stock <= stock_on_hand), is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  'CREATE TABLE IF NOT EXISTS product_orders (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, product_id VARCHAR(36) NOT NULL REFERENCES products(id), quantity INT NOT NULL CHECK (quantity > 0), product_title_snapshot TEXT NOT NULL, unit_price_vnd BIGINT NOT NULL CHECK (unit_price_vnd >= 0), status TEXT NOT NULL CHECK (status IN (\'pending\',\'confirmed\',\'completed\',\'cancelled\')), idempotency_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ, UNIQUE (user_id, idempotency_key))',
  'CREATE TABLE IF NOT EXISTS workshop_sessions (id VARCHAR(36) PRIMARY KEY, workshop_id VARCHAR(36) NOT NULL, starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at), price_vnd BIGINT NOT NULL CHECK (price_vnd >= 0), capacity INT NOT NULL CHECK (capacity >= 0), reserved_seats INT NOT NULL DEFAULT 0 CHECK (reserved_seats >= 0 AND reserved_seats <= capacity), is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  'CREATE TABLE IF NOT EXISTS workshop_session_bookings (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, session_id VARCHAR(36) NOT NULL REFERENCES workshop_sessions(id), seats INT NOT NULL CHECK (seats > 0), title_snapshot TEXT NOT NULL, price_vnd_snapshot BIGINT NOT NULL CHECK (price_vnd_snapshot >= 0), status TEXT NOT NULL CHECK (status IN (\'pending\',\'confirmed\',\'completed\',\'cancelled\')), idempotency_key TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), confirmed_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ, UNIQUE (user_id, idempotency_key))',
  'CREATE TABLE IF NOT EXISTS point_ledger (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, delta INT NOT NULL, reason TEXT NOT NULL, reference_type TEXT NOT NULL, reference_id VARCHAR(36) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (user_id, reason, reference_type, reference_id))',
  'CREATE TABLE IF NOT EXISTS idempotency_keys (user_id VARCHAR(36) NOT NULL, operation TEXT NOT NULL, key TEXT NOT NULL, payload_hash TEXT NOT NULL, response_status INT, response_body JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), committed_at TIMESTAMPTZ, PRIMARY KEY (user_id, operation, key))',
  'CREATE TABLE IF NOT EXISTS festival_tickets (id VARCHAR(36) PRIMARY KEY, user_id VARCHAR(36) NOT NULL, festival_id VARCHAR(36) NOT NULL, ticket_code TEXT NOT NULL UNIQUE, status TEXT NOT NULL CHECK (status IN (\'active\',\'cancelled\',\'used\')), used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  'CREATE TABLE IF NOT EXISTS legacy_commerce_reconciliation (id VARCHAR(36) PRIMARY KEY, legacy_table TEXT NOT NULL, legacy_id VARCHAR(255) NOT NULL, target_type TEXT, target_id VARCHAR(36), state TEXT NOT NULL CHECK (state IN (\'pending\',\'verified\',\'blocked\')), reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (legacy_table, legacy_id))',
  'CREATE INDEX IF NOT EXISTS idx_product_orders_user_created ON product_orders (user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_workshop_session_bookings_user_created ON workshop_session_bookings (user_id, created_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_point_ledger_user_created ON point_ledger (user_id, created_at DESC)'
];

async function main() {
  const checksum = crypto.createHash('sha256').update(statements.join('\n')).digest('hex');
  const client = await pool.connect();
  try {
    await client.query(statements[0]);
    const result = await client.query('SELECT checksum FROM schema_migrations WHERE id = $1', [migrationId]);
    if (result.rows[0]) {
      if (result.rows[0].checksum !== checksum) throw new Error('Migration checksum mismatch.');
      console.log(migrationId + ' already applied.');
      return;
    }
    if (dryRun) {
      console.log(JSON.stringify({ migrationId, statements: statements.length, checksum, dryRun: true }));
      return;
    }
    await client.query('BEGIN');
    for (const statement of statements.slice(1)) await client.query(statement);
    await client.query('INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)', [migrationId, checksum]);
    await client.query('COMMIT');
    console.log(migrationId + ' applied.');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
