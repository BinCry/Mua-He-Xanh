const db = require('./src/core/database');

(async () => {
    try {
        const [rows] = await db.query('SELECT COUNT(*) as total FROM analytics');
        console.log('Total analytics rows:', rows[0].total);
        
        const [sample] = await db.query('SELECT * FROM analytics ORDER BY created_at DESC LIMIT 5');
        console.log('Recent analytics:', JSON.stringify(sample, null, 2));

        const [cols] = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='analytics'");
        console.log('Analytics columns:', JSON.stringify(cols, null, 2));
    } catch (e) {
        console.error('Analytics query error:', e.message);
    }
    process.exit(0);
})();
