#!/usr/bin/env node
/*
 * Read-only legacy-commerce reconciliation report.
 * It intentionally never guesses that a legacy workshop is a product or a
 * session. Any missing relationship is reported as blocked for manual review.
 */
const { Pool } = require('pg');

const connectionString = String(process.env.DATABASE_URL || '').trim();
if (!connectionString) throw new Error('DATABASE_URL is required.');
const isLocal = /localhost|127\.0\.0\.1|\[::1\]/i.test(connectionString);
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
});

async function exists(client, table) {
  const result = await client.query('SELECT to_regclass($1) AS name', ['public.' + table]);
  return Boolean(result.rows[0]?.name);
}

async function count(client, sql) {
  const result = await client.query(sql);
  return Number(result.rows[0]?.total || 0);
}

async function main() {
  const client = await pool.connect();
  try {
    const hasWorkshops = await exists(client, 'workshops');
    const hasBookings = await exists(client, 'workshop_bookings');
    const report = {
      mode: 'read-only',
      generatedAt: new Date().toISOString(),
      tables: { workshops: hasWorkshops, workshop_bookings: hasBookings },
      legacy: { workshops: 0, bookings: 0, bookingStates: [] },
      blocked: []
    };
    if (hasWorkshops) report.legacy.workshops = await count(client, 'SELECT COUNT(*) AS total FROM workshops');
    if (hasBookings) {
      report.legacy.bookings = await count(client, 'SELECT COUNT(*) AS total FROM workshop_bookings');
      const states = await client.query("SELECT COALESCE(status, '(null)') AS status, COUNT(*) AS total FROM workshop_bookings GROUP BY status ORDER BY status");
      report.legacy.bookingStates = states.rows.map(row => ({ status: row.status, total: Number(row.total) }));
      const orphanWorkshops = await client.query(
        'SELECT wb.id FROM workshop_bookings wb LEFT JOIN workshops w ON w.id = wb.workshop_id WHERE w.id IS NULL LIMIT 100'
      );
      for (const row of orphanWorkshops.rows) report.blocked.push({ legacyTable: 'workshop_bookings', legacyId: row.id, reason: 'missing_workshop' });
      const orphanUsers = await client.query(
        'SELECT wb.id FROM workshop_bookings wb LEFT JOIN users u ON u.id = wb.user_id WHERE wb.user_id IS NOT NULL AND u.id IS NULL LIMIT 100'
      );
      for (const row of orphanUsers.rows) report.blocked.push({ legacyTable: 'workshop_bookings', legacyId: row.id, reason: 'missing_user' });
      const invalidSeats = await client.query(
        'SELECT id FROM workshop_bookings WHERE num_people IS NULL OR num_people < 1 LIMIT 100'
      );
      for (const row of invalidSeats.rows) report.blocked.push({ legacyTable: 'workshop_bookings', legacyId: row.id, reason: 'invalid_quantity' });
    }
    report.decision = report.blocked.length ? 'BLOCKED_FOR_MANUAL_RECONCILIATION' : 'REQUIRES_BUSINESS_MAPPING_APPROVAL';
    report.note = 'No records were migrated. Product versus workshop-session classification requires explicit approved mapping.';
    console.log(JSON.stringify(report, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
