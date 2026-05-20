const db = require('../src/core/database');
const fs = require('fs');
const path = require('path');

const TABLES = [
    'analytics',
    'check_ins',
    'journey_stops',
    'journeys',
    'messages',
    'notifications',
    'orders',
    'cart_items',
    'review_comments',
    'review_likes',
    'reviews',
    'user_badges',
    'user_rewards',
    'workshop_bookings'
];

async function reset() {
    try {
        console.log('📦 Starting database reset and backup...');

        // 1. Fetch current data for backup
        const backup = {};
        for (let table of TABLES) {
            try {
                const [rows] = await db.query(`SELECT * FROM ${table}`);
                backup[table] = rows;
                console.log(`  Read ${rows.length} rows from table: ${table}`);
            } catch (e) {
                console.log(`  ⚠️ Failed to read ${table}: ${e.message}`);
            }
        }

        // 2. Save backup to file
        const backupPath = path.join(__dirname, 'backup_data.json');
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
        console.log(`✅ Backup saved to: ${backupPath}`);

        // 3. Clear data from tables
        await db.query('SET FOREIGN_KEY_CHECKS = 0');
        for (let table of TABLES) {
            try {
                await db.query(`TRUNCATE TABLE ${table}`);
                console.log(`  🧹 Truncated table: ${table}`);
            } catch (e) {
                try {
                    await db.query(`DELETE FROM ${table}`);
                    console.log(`  🧹 Cleared table via DELETE: ${table}`);
                } catch (delErr) {
                    console.log(`  ❌ Failed to clear ${table}: ${delErr.message}`);
                }
            }
        }
        await db.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('✅ Database reset completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Reset failed:', e);
        process.exit(1);
    }
}

reset();
