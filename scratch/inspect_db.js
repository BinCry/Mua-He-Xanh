const db = require('../src/core/database');

async function inspect() {
    try {
        const [tables] = await db.query('SHOW TABLES');
        console.log('Tables in database:');
        for (let row of tables) {
            const tableName = Object.values(row)[0];
            const [columns] = await db.query(`DESCRIBE ${tableName}`);
            console.log(`- ${tableName} (${columns.map(c => c.Field).join(', ')})`);
        }
        process.exit(0);
    } catch (e) {
        console.error('Inspection failed:', e);
        process.exit(1);
    }
}

inspect();
