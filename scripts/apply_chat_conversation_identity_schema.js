#!/usr/bin/env node
/*
 * Gives each authenticated customer conversation a stable account key.  Session
 * UUIDs remain short-lived security credentials and are no longer the sole
 * address used to find a chat after login, logout, or a role change.
 */
const crypto = require('crypto');
const { Pool } = require('pg');

const migrationId = '20261121_chat_conversation_identity_v1';
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
    'ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_user_id VARCHAR(36)',
    `UPDATE messages m
     SET conversation_user_id = m.sender_id
     WHERE m.conversation_user_id IS NULL
       AND m.sender_uuid IS NOT NULL AND m.sender_uuid != ''
       AND m.sender_id IS NOT NULL`,
    `UPDATE messages m
     SET conversation_user_id = (
         SELECT previous.conversation_user_id
         FROM messages previous
         WHERE previous.sender_uuid = m.receiver_uuid
           AND previous.conversation_user_id IS NOT NULL
         ORDER BY previous.created_at DESC NULLS LAST
         LIMIT 1
     )
     WHERE m.conversation_user_id IS NULL AND m.receiver_uuid IS NOT NULL`,
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation_user ON messages(conversation_user_id, destination_id, created_at DESC) WHERE conversation_user_id IS NOT NULL'
];

async function main() {
    const checksum = crypto.createHash('sha256').update(statements.join('\n')).digest('hex');
    const client = await pool.connect();
    try {
        await client.query('SET search_path TO public');
        const table = await client.query("SELECT to_regclass('public.messages') AS name");
        if (!table.rows[0]?.name) throw new Error('Missing baseline table messages.');
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
        for (const statement of statements) await client.query(statement);
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
