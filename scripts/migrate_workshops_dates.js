const db = require('../src/core/database');

async function migrate() {
    try {
        console.log('🔄 Checking workshops table columns...');
        const [columns] = await db.query('DESCRIBE workshops');
        const colNames = columns.map(c => c.Field);
        
        if (!colNames.includes('start_date')) {
            await db.query('ALTER TABLE workshops ADD COLUMN start_date DATETIME NULL');
            console.log('✅ Added start_date column to workshops');
        } else {
            console.log('ℹ️ start_date column already exists');
        }
        
        if (!colNames.includes('end_date')) {
            await db.query('ALTER TABLE workshops ADD COLUMN end_date DATETIME NULL');
            console.log('✅ Added end_date column to workshops');
        } else {
            console.log('ℹ️ end_date column already exists');
        }
        
        console.log('🎉 Workshops migration completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration failed:', e);
        process.exit(1);
    }
}

migrate();
