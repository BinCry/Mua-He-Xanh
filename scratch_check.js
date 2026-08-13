const db = require('./src/core/database');

async function migrate() {
    try {
        console.log("Adding guest_uuid column to review_comments...");
        await db.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS guest_uuid VARCHAR(255)`);
        
        console.log("Adding guest_uuid column to review_likes...");
        await db.query(`ALTER TABLE review_likes ADD COLUMN IF NOT EXISTS guest_uuid VARCHAR(255)`);
        
        console.log("Migration SUCCESSFUL!");

        const [commentsCols] = await db.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'review_comments'
        `);
        console.log("New review_comments columns:", commentsCols.map(c => c.column_name));

    } catch(e) {
        console.error("Migration error:", e);
    }
    process.exit(0);
}

migrate();
