/**
 * Export full database (schema + data) to SQL file
 * Usage: node scripts/export_db.js
 */
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DB_CONFIG = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 3306,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
};

async function exportDatabase() {
    const outputFile = path.resolve(__dirname, `../db_export_${new Date().toISOString().replace(/[:.]/g, '-').slice(0,19)}.sql`);
    let conn;
    let output = [];

    try {
        console.log('Connecting to database...');
        console.log(`  Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
        console.log(`  Database: ${DB_CONFIG.database}`);

        conn = await mysql.createConnection(DB_CONFIG);
        console.log('Connected!\n');

        // Header
        output.push('-- ============================================');
        output.push(`-- Database Export: ${DB_CONFIG.database}`);
        output.push(`-- Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
        output.push(`-- Date: ${new Date().toISOString()}`);
        output.push('-- ============================================\n');
        output.push('SET FOREIGN_KEY_CHECKS = 0;');
        output.push('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";');
        output.push('SET AUTOCOMMIT = 0;');
        output.push('START TRANSACTION;\n');

        // Get all tables
        const [tables] = await conn.query('SHOW TABLES');
        const tableKey = Object.keys(tables[0])[0];
        const tableNames = tables.map(t => t[tableKey]);

        console.log(`Found ${tableNames.length} tables: ${tableNames.join(', ')}\n`);

        for (const tableName of tableNames) {
            console.log(`Exporting table: ${tableName}...`);

            // Get CREATE TABLE statement
            const [createResult] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
            const createStmt = createResult[0]['Create Table'];

            output.push(`-- -------------------------------------------`);
            output.push(`-- Table: ${tableName}`);
            output.push(`-- -------------------------------------------`);
            output.push(`DROP TABLE IF EXISTS \`${tableName}\`;`);
            output.push(`${createStmt};\n`);

            // Get all data
            const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);
            
            if (rows.length > 0) {
                output.push(`-- Data for table: ${tableName} (${rows.length} rows)`);
                
                const columns = Object.keys(rows[0]);
                const colList = columns.map(c => `\`${c}\``).join(', ');

                for (const row of rows) {
                    const values = columns.map(col => {
                        const val = row[col];
                        if (val === null) return 'NULL';
                        if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                        if (typeof val === 'number') return val.toString();
                        if (typeof val === 'boolean') return val ? '1' : '0';
                        if (Buffer.isBuffer(val)) return `X'${val.toString('hex')}'`;
                        // Escape string
                        const escaped = String(val)
                            .replace(/\\/g, '\\\\')
                            .replace(/'/g, "\\'")
                            .replace(/\n/g, '\\n')
                            .replace(/\r/g, '\\r')
                            .replace(/\t/g, '\\t');
                        return `'${escaped}'`;
                    });
                    output.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES (${values.join(', ')});`);
                }
                output.push('');
            } else {
                output.push(`-- Table ${tableName} is empty\n`);
            }
        }

        output.push('COMMIT;');
        output.push('SET FOREIGN_KEY_CHECKS = 1;\n');
        output.push('-- ============================================');
        output.push('-- End of export');
        output.push('-- ============================================');

        // Write to file
        fs.writeFileSync(outputFile, output.join('\n'), 'utf8');
        console.log(`\n✅ Export complete!`);
        console.log(`📄 File: ${outputFile}`);
        console.log(`📊 Tables exported: ${tableNames.length}`);
        console.log(`📏 File size: ${(fs.statSync(outputFile).size / 1024).toFixed(1)} KB`);

        // Also print summary to console
        console.log('\n--- DATABASE SUMMARY ---');
        for (const tableName of tableNames) {
            const [countResult] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${tableName}\``);
            console.log(`  ${tableName}: ${countResult[0].cnt} rows`);
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

exportDatabase();
