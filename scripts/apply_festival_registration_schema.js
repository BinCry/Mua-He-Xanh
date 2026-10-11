#!/usr/bin/env node
/*
 * Explicit follow-up migration for festival capacity and registration state.
 * Never invoked by server startup. Run --dry-run before production.
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
const migrationId = '20261011_festival_registration_v1';
const statements = [
  'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
  'ALTER TABLE festivals ADD COLUMN IF NOT EXISTS capacity INT CHECK (capacity IS NULL OR capacity >= 0)',
  'ALTER TABLE festivals ADD COLUMN IF NOT EXISTS registration_open BOOLEAN NOT NULL DEFAULT TRUE',
  'CREATE INDEX IF NOT EXISTS idx_festival_tickets_festival_status ON festival_tickets (festival_id, status)'
];

async function main() {
  const checksum = crypto.createHash('sha256').update(statements.join('\n')).digest('hex');
  const client = await pool.connect();
  try {
    await client.query(statements[0]);
    const applied = await client.query('SELECT checksum FROM schema_migrations WHERE id = $1', [migrationId]);
    if (applied.rows[0]) {
      if (applied.rows[0].checksum !== checksum) throw new Error('Migration checksum mismatch.');
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
