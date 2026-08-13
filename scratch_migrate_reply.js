const db = require('./src/core/database');

async function migrateReply() {
    try {
        console.log("Adding parent_id column to review_comments...");
        await db.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255)`);
        console.log("Migration SUCCESSFUL!");

        const [cols] = await db.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'review_comments'
        `);
        console.log("Current review_comments columns:", cols.map(c => c.column_name));
    } catch(e) {
        console.error("Migration error:", e);
    }
    process.exit(0);
}

migrateReply();
