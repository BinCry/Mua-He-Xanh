#!/usr/bin/env node
/*
 * Adds the staff-facing booking reference without replacing the UUID primary key.
 * Existing rows receive a stable BK-XXXXXXXXXXXX value derived from their UUID.
 */
const crypto = require('node:crypto');
const { Pool } = require('pg');

const connectionString = String(process.env.DATABASE_URL || '').trim();
const dryRun = process.argv.includes('--dry-run');
if (!connectionString) throw new Error('DATABASE_URL is required.');

const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(connectionString);
const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : {
        rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'
    }
});
const migrationId = '20261127_workshop_booking_reference_v1';
const statements = [
    'ALTER TABLE workshop_session_bookings ADD COLUMN IF NOT EXISTS booking_reference VARCHAR(20)',
    `UPDATE workshop_session_bookings
     SET booking_reference = 'BK-' || UPPER(SUBSTRING(MD5(id) FROM 1 FOR 12))
     WHERE booking_reference IS NULL OR booking_reference = ''`,
    'ALTER TABLE workshop_session_bookings ALTER COLUMN booking_reference SET NOT NULL',
    'CREATE UNIQUE INDEX IF NOT EXISTS ux_workshop_session_bookings_reference ON workshop_session_bookings (booking_reference)'
];

async function main() {
    const checksum = crypto.createHash('sha256').update(statements.join('\n')).digest('hex');
    const client = await pool.connect();
    try {
        await client.query('SET search_path TO public');
        const table = await client.query(
            "SELECT to_regclass('public.workshop_session_bookings') AS name"
        );
        if (!table.rows[0]?.name) throw new Error('workshop_session_bookings table is missing.');
        if (dryRun) {
            console.log(JSON.stringify({ migrationId, statements: statements.length, checksum, dryRun: true }));
            return;
        }
        await client.query(
            'CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())'
        );
        const applied = await client.query(
            'SELECT checksum FROM schema_migrations WHERE id = $1',
            [migrationId]
        );
        if (applied.rows[0]) {
            if (applied.rows[0].checksum !== checksum) {
                throw new Error('Migration checksum mismatch.');
            }
            console.log(`${migrationId} already applied.`);
            return;
        }
        await client.query('BEGIN');
        for (const statement of statements) await client.query(statement);
        const invalid = await client.query(
            `SELECT id FROM workshop_session_bookings
             WHERE booking_reference !~ '^BK-[A-F0-9]{12}$' LIMIT 1`
        );
        if (invalid.rows.length) throw new Error('Invalid booking reference after backfill.');
        await client.query(
            'INSERT INTO schema_migrations (id, checksum) VALUES ($1, $2)',
            [migrationId, checksum]
        );
        await client.query('COMMIT');
        console.log(`${migrationId} applied.`);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
});
