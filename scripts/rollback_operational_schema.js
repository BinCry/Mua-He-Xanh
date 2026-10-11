#!/usr/bin/env node
/*
 * Controlled rollback for 20261011_operational_domains_v1.
 *
 * It is deliberately opt-in and refuses to drop a table that contains
 * operational data. For a populated deployment, restore the verified backup
 * instead of attempting a destructive schema rollback in place.
 */
const { Pool } = require('pg');

const migrationId = '20261011_operational_domains_v1';
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

const tables = [
    'workshop_session_bookings', 'product_orders', 'workshop_sessions',
    'products', 'point_ledger', 'idempotency_keys', 'festival_tickets',
    'legacy_commerce_reconciliation'
];

async function main() {
    const client = await pool.connect();
    try {
        await client.query('SET search_path TO public');
        const migration = await client.query(
            'SELECT id FROM schema_migrations WHERE id = $1', [migrationId]
        );
        if (!migration.rows[0]) {
            console.log(JSON.stringify({ migrationId, rollback: 'not_applied' }));
            return;
        }

        const counts = {};
        for (const table of tables) {
            const exists = await client.query('SELECT to_regclass($1) AS name', [`public.${table}`]);
            if (!exists.rows[0].name) continue;
            const result = await client.query(`SELECT COUNT(*)::int AS total FROM ${table}`);
            counts[table] = result.rows[0].total;
        }
        const populated = Object.entries(counts).filter(([, total]) => total > 0);
        if (populated.length) {
            throw new Error(`Refusing in-place rollback with operational data: ${populated.map(([table, total]) => `${table}=${total}`).join(', ')}. Restore the verified database backup instead.`);
        }
        if (!apply) {
            console.log(JSON.stringify({ migrationId, dryRun: true, counts, action: 'would_drop_empty_operational_tables' }));
            return;
        }

        await client.query('BEGIN');
        for (const table of tables) await client.query(`DROP TABLE IF EXISTS ${table}`);
        await client.query('DELETE FROM schema_migrations WHERE id = $1', [migrationId]);
        await client.query('COMMIT');
        console.log(JSON.stringify({ migrationId, rolledBack: true, counts }));
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
