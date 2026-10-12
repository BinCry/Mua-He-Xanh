#!/usr/bin/env node
/*
 * Separates legacy contact-first Shop entries from the operational Workshop
 * catalogue. This migration is explicit: it is never run at application
 * startup, and must be dry-run against a backup before production execution.
 */
const crypto = require('crypto');
const { Pool } = require('pg');

const connectionString = String(process.env.DATABASE_URL || '').trim();
const dryRun = process.argv.includes('--dry-run');
if (!connectionString) throw new Error('DATABASE_URL is required.');
const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(connectionString);
const pool = new Pool({ connectionString, ssl: isLocal ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } });
const migrationId = '20261012_workshop_catalog_split_v1';
const statements = [
  'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  "ALTER TABLE workshops ADD COLUMN IF NOT EXISTS catalog_kind TEXT NOT NULL DEFAULT 'shop'",
  "UPDATE workshops SET catalog_kind = 'shop' WHERE catalog_kind IS NULL OR catalog_kind NOT IN ('shop', 'workshop')",
  "ALTER TABLE workshops DROP CONSTRAINT IF EXISTS workshops_catalog_kind_check",
  "ALTER TABLE workshops ADD CONSTRAINT workshops_catalog_kind_check CHECK (catalog_kind IN ('shop', 'workshop'))",
  'CREATE INDEX IF NOT EXISTS idx_workshops_catalog_destination ON workshops (catalog_kind, destination_id, is_active)'
];

async function hasColumn(client) {
  const result = await client.query("SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workshops' AND column_name = 'catalog_kind'");
  return result.rowCount === 1;
}

async function main() {
  const checksum = crypto.createHash('sha256').update(statements.join('\n')).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO public');
    const exists = await client.query('SELECT to_regclass($1) AS name', ['public.workshops']);
    if (!exists.rows[0]?.name) throw new Error('workshops table is required before this migration.');
    const migrationsExists = await client.query('SELECT to_regclass($1) AS name', ['public.schema_migrations']);
    const prior = migrationsExists.rows[0]?.name
      ? await client.query('SELECT checksum FROM schema_migrations WHERE id = $1', [migrationId])
      : { rows: [] };
    if (prior.rows[0]) {
      if (prior.rows[0].checksum !== checksum) throw new Error('Migration checksum mismatch.');
      if (!await hasColumn(client)) throw new Error('Applied migration schema drift: workshops.catalog_kind missing.');
      console.log(migrationId + ' already applied.');
      return;
    }
    if (dryRun) {
      console.log(JSON.stringify({ migrationId, statements: statements.length, checksum, dryRun: true, legacyRowsBecome: 'shop' }));
      return;
    }
    await client.query('BEGIN');
    for (const statement of statements) await client.query(statement);
    if (!await hasColumn(client)) throw new Error('Migration did not add workshops.catalog_kind.');
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
