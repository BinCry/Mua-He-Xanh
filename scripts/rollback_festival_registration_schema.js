#!/usr/bin/env node
/*
 * Controlled rollback for 20261011_festival_registration_v1. It only permits
 * removal while the newly-added capacity/registration fields retain their
 * original default values, so no edited festival configuration is discarded.
 */
const { Pool } = require('pg');

const migrationId = '20261011_festival_registration_v1';
const connectionString = String(process.env.DATABASE_URL || '').trim();
const apply = process.argv.includes('--apply');
const confirmed = process.argv.includes(`--confirm-migration-id=${migrationId}`);
if (!connectionString) throw new Error('DATABASE_URL is required.');
if (apply && !confirmed) throw new Error(`Refusing rollback without --confirm-migration-id=${migrationId}.`);

const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(connectionString);
const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
});

async function main() {
    const client = await pool.connect();
    try {
        await client.query('SET search_path TO public');
        const migration = await client.query('SELECT id FROM schema_migrations WHERE id = $1', [migrationId]);
        if (!migration.rows[0]) {
            console.log(JSON.stringify({ migrationId, rollback: 'not_applied' }));
            return;
        }
        const changed = await client.query(
            'SELECT COUNT(*)::int AS total FROM festivals WHERE capacity IS NOT NULL OR registration_open IS DISTINCT FROM TRUE'
        );
        if (changed.rows[0].total > 0) {
            throw new Error('Refusing in-place rollback because festival registration data changed. Restore the verified database backup instead.');
        }
        if (!apply) {
            console.log(JSON.stringify({ migrationId, dryRun: true, changedFestivals: changed.rows[0].total, action: 'would_drop_default_registration_columns' }));
            return;
        }
        await client.query('BEGIN');
        await client.query('DROP INDEX IF EXISTS idx_festival_tickets_festival_status');
        await client.query('ALTER TABLE festivals DROP COLUMN IF EXISTS registration_open');
        await client.query('ALTER TABLE festivals DROP COLUMN IF EXISTS capacity');
        await client.query('DELETE FROM schema_migrations WHERE id = $1', [migrationId]);
        await client.query('COMMIT');
        console.log(JSON.stringify({ migrationId, rolledBack: true }));
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
