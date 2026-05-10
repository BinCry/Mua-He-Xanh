const db = require('../src/core/database');

async function migrate() {
    try {
        // 1. Create roles table (tham khảo mô hình Relioo nhóm 9)
        await db.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                role_name VARCHAR(50) NOT NULL UNIQUE,
                description VARCHAR(255),
                permissions JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Bảng roles đã tạo');

        // 2. Seed roles (Mapping từ Relioo: CEO→admin, Leader→manager, Staff→user, SuperAdmin→superadmin)
        await db.query(`
            INSERT IGNORE INTO roles (id, role_name, description, permissions) VALUES
            (1, 'admin', 'Quản trị viên hệ thống - Toàn quyền', JSON_ARRAY('all')),
            (2, 'manager', 'Quản lý địa điểm - Quản lý workshop, chat, booking', JSON_ARRAY('manage_destination','manage_workshop','manage_chat','view_analytics')),
            (3, 'user', 'Du khách - Khám phá, check-in, đặt workshop', JSON_ARRAY('explore','checkin','book_workshop','chat','review')),
            (4, 'guest', 'Khách vãng lai - Chỉ xem', JSON_ARRAY('explore'))
        `);
        console.log('✅ 4 vai trò đã seed: admin, manager, user, guest');

        // 3. Ensure role_id column exists in users
        try {
            await db.query(`ALTER TABLE users ADD COLUMN role_id INT DEFAULT 3`);
            console.log('✅ Thêm cột role_id vào bảng users');
        } catch(e) {
            if (e.message.includes('Duplicate column')) {
                console.log('ℹ️  Cột role_id đã tồn tại');
            } else {
                throw e;
            }
        }

        // 4. Map existing string roles to role_id
        await db.query(`UPDATE users SET role_id = 1 WHERE role = 'admin'`);
        await db.query(`UPDATE users SET role_id = 2 WHERE role = 'manager'`);
        await db.query(`UPDATE users SET role_id = 3 WHERE role = 'user' OR role IS NULL`);
        console.log('✅ Đã đồng bộ role string → role_id');

        // 5. Ensure is_active column exists
        try {
            await db.query(`ALTER TABLE users ADD COLUMN is_active TINYINT(1) DEFAULT 1`);
            console.log('✅ Thêm cột is_active vào bảng users');
        } catch(e) {
            if (e.message.includes('Duplicate column')) {
                console.log('ℹ️  Cột is_active đã tồn tại');
            } else {
                throw e;
            }
        }

        console.log('\n🎉 Migration phân quyền hoàn tất!');
        process.exit(0);
    } catch(e) {
        console.error('❌ Migration Error:', e.message);
        process.exit(1);
    }
}

migrate();
