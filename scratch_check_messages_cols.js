const db = require('./src/core/database');

async function checkMessagesCols() {
    try {
        const [cols] = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'messages'
        `);
        console.log("=== MESSAGES TABLE COLUMNS ===");
        console.log(cols);
    } catch(e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

checkMessagesCols();
