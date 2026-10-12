#!/usr/bin/env node
/*
 * Forward-only authentication-session schema migration.  It is deliberately
 * explicit: startup must never alter a production database.  A created_at
 * timestamp lets server-side UUID recovery expire with the browser cookie.
 */
const crypto = require('crypto');
const { Pool } = require('pg');

const migrationId = '20261012_auth_session_expiry_v1';
const connectionString = String(process.env.DATABASE_URL || '').trim();
const dryRun = process.argv.includes('--dry-run');
if (!connectionString) throw new Error('DATABASE_URL is required.');

const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(connectionString);
const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
});

const statements = [
    'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())',
    'ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ',
    'UPDATE user_sessions SET created_at = COALESCE(created_at, updated_at, NOW()) WHERE created_at IS NULL',
    'ALTER TABLE user_sessions ALTER COLUMN created_at SET DEFAULT NOW()',
    'ALTER TABLE user_sessions ALTER COLUMN created_at SET NOT NULL',
    'CREATE INDEX IF NOT EXISTS idx_user_sessions_auth_expiry ON user_sessions (uuid, created_at DESC) WHERE user_id IS NOT NULL'
];

async function hasCreatedAt(client) {
    const result = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'user_sessions' AND column_name = 'created_at'`,
    );
    return result.rowCount === 1;
}

async function main() {
    const checksum = crypto.createHash('sha256').update(statements.join('\n')).digest('hex');
    const client = await pool.connect();
    try {
        await client.query('SET search_path TO public');
        const sessionTable = await client.query("SELECT to_regclass('public.user_sessions') AS name");
        if (!sessionTable.rows[0]?.name) {
            throw new Error('Missing baseline table user_sessions. Run the baseline migration before this migration.');
        }
        const migrationTable = await client.query("SELECT to_regclass('public.schema_migrations') AS name");
        const applied = migrationTable.rows[0]?.name
            ? await client.query('SELECT checksum FROM schema_migrations WHERE id = $1', [migrationId])
            : { rows: [] };
        if (applied.rows[0]) {
            if (applied.rows[0].checksum !== checksum) throw new Error('Migration checksum mismatch.');
            if (!await hasCreatedAt(client)) throw new Error('Applied migration schema drift: user_sessions.created_at is missing.');
            console.log(migrationId + ' already applied.');
            return;
        }
        if (dryRun) {
            console.log(JSON.stringify({ migrationId, statements: statements.length, checksum, dryRun: true, action: 'add_auth_session_created_at' }));
            return;
        }
        await client.query('BEGIN');
        for (const statement of statements) await client.query(statement);
        if (!await hasCreatedAt(client)) throw new Error('Migration did not produce user_sessions.created_at.');
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
