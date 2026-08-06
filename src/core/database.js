const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Tuandat2204%40@db.dipwbbwedjjmkrmejkjc.supabase.co:5432/postgres';

const pgPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

const pool = {
    async query(sql, params = []) {
        const res = await pgPool.query(sql, params);
        const rows = res.rows || [];
        rows.affectedRows = res.rowCount || 0;
        rows.rowCount = res.rowCount || 0;
        rows.insertId = rows[0]?.id || null;
        return [rows, res.fields];
    },
    async execute(sql, params = []) {
        return this.query(sql, params);
    },
    pgPool
};

module.exports = pool;
