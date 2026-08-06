const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:Tuandat2204%40@db.dipwbbwedjjmkrmejkjc.supabase.co:5432/postgres';

const pgPool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

// Convert legacy '?' placeholders to PostgreSQL '$1, $2, $3...'
function convertQueryToPg(sql) {
    if (!sql) return sql;
    let paramIndex = 1;
    let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    pgSql = pgSql.replace(/ORDER BY RAND\(\)/gi, 'ORDER BY RANDOM()');
    pgSql = pgSql.replace(/=\s*TRUE\b/gi, '= 1');
    pgSql = pgSql.replace(/=\s*FALSE\b/gi, '= 0');
    pgSql = pgSql.replace(/\bIS TRUE\b/gi, '= 1');
    pgSql = pgSql.replace(/\bIS FALSE\b/gi, '= 0');
    return pgSql;
}

const pool = {
    async query(sql, params = []) {
        const pgSql = convertQueryToPg(sql);
        const res = await pgPool.query(pgSql, params);
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
