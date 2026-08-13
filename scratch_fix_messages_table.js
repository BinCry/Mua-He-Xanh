const db = require('./src/core/database');

async function fixMessagesTable() {
    try {
        console.log("Fixing messages table columns...");
        await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS message TEXT`);
        await db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_ai INTEGER DEFAULT 0`);
        console.log("Migration SUCCESSFUL!");
    } catch(e) {
        console.error("Migration error:", e);
    }
    process.exit(0);
}

fixMessagesTable();
