const { Pool } = require('pg');
require('dotenv').config();

let connectionString = process.env.DATABASE_URL || 'postgresql://postgres.dipwbbwedjjmkrmejkjc:Tuandat2204%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

// Auto-fix direct connection strings (which are IPv6 only) to use Supabase IPv4 Pooler
if (!connectionString || connectionString.includes('db.dipwbbwedjjmkrmejkjc.supabase.co') || !connectionString.includes('pooler.supabase.com')) {
    connectionString = 'postgresql://postgres.dipwbbwedjjmkrmejkjc:Tuandat2204%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
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
        const MAX_RETRIES = 2;
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
                if (attempt < MAX_RETRIES && (
                    err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' ||
                    err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET'
                )) {
                    console.warn(`DB retry ${attempt}/${MAX_RETRIES}: ${err.code}`);
                    await new Promise(r => setTimeout(r, 1000));
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
