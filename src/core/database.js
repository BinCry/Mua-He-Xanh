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
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

pgPool.on('error', (err) => {
    console.error('Unexpected pgPool error:', err.message);
});

const pool = {
    async query(sql, params = []) {
        try {
            const res = await pgPool.query(sql, params);
            const rows = res.rows || [];
            rows.affectedRows = res.rowCount || 0;
            rows.rowCount = res.rowCount || 0;
            rows.insertId = rows[0]?.id || null;
            return [rows, res.fields];
        } catch (err) {
            console.error('Database query error:', err.message, 'SQL:', sql);
            throw err;
        }
    },
    async execute(sql, params = []) {
        return this.query(sql, params);
    },
    pgPool
};

module.exports = pool;
