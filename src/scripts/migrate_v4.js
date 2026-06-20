const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

async function migrate() {
    console.log('🔄 Starting migration v4...');

    try {
        // 1. Alter events table
        const [eventCols] = await db.query('DESCRIBE events');
        const eventColNames = eventCols.map(c => c.Field);

        if (!eventColNames.includes('is_countdown')) {
            await db.query('ALTER TABLE events ADD COLUMN is_countdown TINYINT(1) DEFAULT 0');
            console.log('  ✅ events.is_countdown added');
        }
        if (!eventColNames.includes('status')) {
            await db.query('ALTER TABLE events ADD COLUMN status VARCHAR(50) DEFAULT \'upcoming\'');
            console.log('  ✅ events.status added');
        }

        // 2. Create user_favorites table
        await db.query(`
            CREATE TABLE IF NOT EXISTS user_favorites (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                destination_id VARCHAR(36) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_fav (user_id, destination_id)
            )
        `);
        console.log('  ✅ user_favorites table created/checked');

        // 3. Create destination_likes table
        await db.query(`
            CREATE TABLE IF NOT EXISTS destination_likes (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                destination_id VARCHAR(36) NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (user_id, destination_id)
            )
        `);
        console.log('  ✅ destination_likes table created/checked');

        // 4. Create soundscapes table
        await db.query(`
            CREATE TABLE IF NOT EXISTS soundscapes (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(300) NOT NULL,
                mood ENUM('calm','wild','night') NOT NULL,
                audio_url VARCHAR(500) NOT NULL,
                duration_seconds INT DEFAULT 0,
                is_active TINYINT(1) DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('  ✅ soundscapes table created/checked');

        // 5. Migrate festivals data to events table
        const [festivals] = await db.query('SELECT * FROM festivals');
        console.log(`  Found ${festivals.length} festivals to migrate...`);

        for (const fest of festivals) {
            // Check if already migrated by checking if the id exists in events
            const [existing] = await db.query('SELECT id FROM events WHERE id = ?', [fest.id]);
            if (existing.length === 0) {
                // Map fields: name -> title, date -> event_date, description -> description, image -> image, status -> status
                // We'll set is_active = 1, is_countdown = 0
                await db.query(
                    `INSERT INTO events (id, title, description, event_date, image, status, is_active, is_countdown)
                     VALUES (?, ?, ?, ?, ?, ?, 1, 0)`,
                    [fest.id, fest.name, fest.description, fest.date, fest.image, fest.status || 'upcoming']
                );
                console.log(`    Migrated festival: ${fest.name}`);
            } else {
                console.log(`    Festival already exists in events: ${fest.name}`);
            }
        }

        console.log('\n✅ Migration v4 completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
