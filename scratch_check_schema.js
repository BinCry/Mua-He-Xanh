const db = require('./src/core/database');

async function checkSchema() {
    try {
        const [userSessionCols] = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'user_sessions'
        `);
        console.log("=== USER_SESSIONS COLUMNS ===");
        console.log(userSessionCols.map(c => `${c.column_name} (${c.data_type})`));

        const [journeyCols] = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'journeys'
        `);
        console.log("=== JOURNEYS COLUMNS ===");
        console.log(journeyCols.map(c => `${c.column_name} (${c.data_type})`));
    } catch(e) {
        console.error("Schema error:", e);
    }
    process.exit(0);
}

checkSchema();
