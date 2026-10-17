#!/usr/bin/env node
/*
 * Forward-only visibility state for administrator-managed Journey tours.
 * This script is explicit so application startup never changes production data.
 */
const crypto = require('crypto');
const { Pool } = require('pg');

const migrationId = '20261017_journey_template_visibility_v1';
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
    'ALTER TABLE seasonal_journey_templates ADD COLUMN IF NOT EXISTS is_active INT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))'
];

async function hasVisibilityColumn(client) {
    const result = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'seasonal_journey_templates' AND column_name = 'is_active'`
    );
    return result.rowCount === 1;
}

async function main() {
    const checksum = crypto.createHash('sha256').update(statements.join('\n')).digest('hex');
    const client = await pool.connect();
    try {
        await client.query('SET search_path TO public');
        const templateTable = await client.query("SELECT to_regclass('public.seasonal_journey_templates') AS name");
        if (!templateTable.rows[0]?.name) {
            throw new Error('Missing baseline table seasonal_journey_templates. Run the baseline migration first.');
        }
        const migrationTable = await client.query("SELECT to_regclass('public.schema_migrations') AS name");
        const applied = migrationTable.rows[0]?.name
            ? await client.query('SELECT checksum FROM schema_migrations WHERE id = $1', [migrationId])
            : { rows: [] };
        if (applied.rows[0]) {
            if (applied.rows[0].checksum !== checksum) throw new Error('Migration checksum mismatch.');
            if (!await hasVisibilityColumn(client)) throw new Error('Applied migration schema drift: seasonal_journey_templates.is_active is missing.');
            console.log(migrationId + ' already applied.');
            return;
        }
        if (dryRun) {
            console.log(JSON.stringify({ migrationId, statements: statements.length, checksum, dryRun: true, action: 'add_journey_template_visibility' }));
            return;
        }
        await client.query('BEGIN');
        for (const statement of statements) await client.query(statement);
        if (!await hasVisibilityColumn(client)) throw new Error('Migration did not produce seasonal_journey_templates.is_active.');
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
