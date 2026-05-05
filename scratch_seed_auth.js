const db = require('./src/core/database');

async function seed() {
    try {
        // Try adding columns one by one
        const columns = [
            "ALTER TABLE users ADD COLUMN full_name varchar(255)",
            "ALTER TABLE users ADD COLUMN avatar text",
            "ALTER TABLE users ADD COLUMN managed_destination_id varchar(36)"
        ];

        for (let sql of columns) {
            try { await db.query(sql); } catch(e) {} // Ignore if column exists
        }

        // Create Admin
        await db.query(`
            INSERT INTO users (id, email, password, full_name, role) 
            VALUES ('admin-id', 'admin@binhloi.vn', 'admin123', 'Quản trị viên', 'admin')
            ON DUPLICATE KEY UPDATE full_name = 'Quản trị viên', role = 'admin'
        `);

        // Get a destination ID for manager
        const [dests] = await db.query("SELECT id FROM destinations LIMIT 1");
        const destId = dests.length > 0 ? dests[0].id : null;

        // Create Manager
        await db.query(`
            INSERT INTO users (id, email, password, full_name, role, managed_destination_id) 
            VALUES ('manager-id', 'manager@binhloi.vn', 'manager123', 'Quản lý Miền Tây', 'manager', ?)
            ON DUPLICATE KEY UPDATE full_name = 'Quản lý Miền Tây', role = 'manager', managed_destination_id = ?
        `, [destId, destId]);

        console.log('Seeding successful: Admin and Manager accounts created.');
        process.exit(0);
    } catch (e) {
        console.error('Seeding failed:', e);
        process.exit(1);
    }
}

seed();
