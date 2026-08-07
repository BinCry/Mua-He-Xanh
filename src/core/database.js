const { Pool } = require('pg');
require('dotenv').config();

let connectionString = process.env.DATABASE_URL;

// Force PostgreSQL connection string (override if old MySQL URL is present in environment)
if (!connectionString || !connectionString.startsWith('postgres')) {
    connectionString = 'postgresql://postgres:Tuandat2204%40@db.dipwbbwedjjmkrmejkjc.supabase.co:5432/postgres';
}

const pgPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 20000,
    connectionTimeoutMillis: 15000
});

pgPool.on('error', (err) => {
    console.error('Unexpected pgPool error:', err.message);
});

const pool = {
    async query(sql, params = []) {
        const MAX_RETRIES = 3;
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const res = await pgPool.query(sql, params);
                const rows = res.rows || [];
                rows.affectedRows = res.rowCount || 0;
                rows.rowCount = res.rowCount || 0;
                rows.insertId = rows[0]?.id || null;
                return [rows, res.fields];
            } catch (err) {
                lastError = err;
                const isRetryable = (
                    err.code === 'ECONNREFUSED' ||
                    err.code === 'ENOTFOUND' ||
                    err.code === 'ETIMEDOUT' ||
                    err.code === 'ECONNRESET' ||
                    err.code === 'EAI_AGAIN' ||
                    err.message?.includes('Connection terminated') ||
                    err.message?.includes('timeout') ||
                    err.message?.includes('connection')
                );

                if (isRetryable && attempt < MAX_RETRIES) {
                    const delay = attempt * 1000;
                    console.warn(`DB query attempt ${attempt} failed (${err.code || err.message}), retrying in ${delay}ms...`);
                    await new Promise(r => setTimeout(r, delay));
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
    pgPool
};

module.exports = pool;
