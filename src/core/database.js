const { Pool, types } = require('pg');
require('dotenv').config();

// Fix timezone issue: PostgreSQL TIMESTAMP columns (1114) in Supabase are UTC
types.setTypeParser(1114, str => str ? new Date(str.replace(' ', 'T') + 'Z') : null);
types.setTypeParser(1184, str => str ? new Date(str) : null);

// Credentials are deployment configuration, never application source code.
// Fail early and clearly rather than silently connecting to an unintended database.
const connectionString = String(process.env.DATABASE_URL || '').trim();
let pgPool = null;

function getPool() {
    if (pgPool) return pgPool;
    if (!connectionString) {
        throw new Error('DATABASE_URL is required. Set it in the deployment environment before running database queries.');
    }
    pgPool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true
    });
    pgPool.on('error', (err) => {
        console.error('Unexpected pgPool error:', err.message);
    });
    return pgPool;
}

const pool = {
    async query(sql, params = []) {
        const MAX_RETRIES = 2;
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await getPool().query(sql, params);
                const rows = res.rows || [];
                rows.affectedRows = res.rowCount || 0;
                rows.rowCount = res.rowCount || 0;
                rows.insertId = rows[0]?.id || null;
                return [rows, res.fields];
            } catch (err) {
                lastError = err;
                if (attempt < MAX_RETRIES && (
                    err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' ||
                    err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET'
                )) {
                    console.warn(`DB retry ${attempt}/${MAX_RETRIES}: ${err.code}`);
                    await new Promise(r => setTimeout(r, 500));
                } else {
                    console.error('Database query error:', err.message, 'SQL:', sql);
                    throw err;
                }
            }
        }
        throw lastError;
    },
    async execute(sql, params = []) {
        return this.query(sql, params);
    },
    async close() {
        if (!pgPool) return;
        const poolToClose = pgPool;
        pgPool = null;
        await poolToClose.end();
    },
    get pgPool() {
        return getPool();
    }
};

module.exports = pool;
