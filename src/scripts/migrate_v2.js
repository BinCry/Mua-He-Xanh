/**
 * Migration V2 - Platform Overhaul
 * Run: node src/scripts/migrate_v2.js
 */
const db = require('../core/database');

async function migrate() {
    console.log('🔄 Starting migration v2...');

    // 1. Add events table for admin-managed featured events
    await db.query(`
        CREATE TABLE IF NOT EXISTS events (
            id VARCHAR(36) PRIMARY KEY,
            title VARCHAR(300) NOT NULL,
            description TEXT,
            season ENUM('spring','summer','autumn','winter','all') DEFAULT 'all',
            event_date DATETIME,
            end_date DATETIME,
            location VARCHAR(300),
            image VARCHAR(500),
            is_featured TINYINT(1) DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            sort_order INT DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `).then(() => console.log('  ✅ events table created'))
      .catch(e => console.log('  ⚠️ events:', e.message));

    // 2. Add seasonal_experiences table
    await db.query(`
        CREATE TABLE IF NOT EXISTS seasonal_experiences (
            id VARCHAR(36) PRIMARY KEY,
            title VARCHAR(300) NOT NULL,
            description TEXT,
            icon VARCHAR(100),
            icon_color VARCHAR(50) DEFAULT 'warning',
            season ENUM('spring','summer','autumn','winter') NOT NULL,
            sort_order INT DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `).then(() => console.log('  ✅ seasonal_experiences table created'))
      .catch(e => console.log('  ⚠️ seasonal_experiences:', e.message));

    // 3. Add location fields to reviews for community geo-tagging
    const reviewCols = await db.query('DESCRIBE reviews').then(([r]) => r.map(c => c.Field));
    if (!reviewCols.includes('location_lat')) {
        await db.query(`ALTER TABLE reviews ADD COLUMN location_lat DECIMAL(10,7) NULL`);
        console.log('  ✅ reviews.location_lat added');
    }
    if (!reviewCols.includes('location_lng')) {
        await db.query(`ALTER TABLE reviews ADD COLUMN location_lng DECIMAL(10,7) NULL`);
        console.log('  ✅ reviews.location_lng added');
    }
    if (!reviewCols.includes('location_name')) {
        await db.query(`ALTER TABLE reviews ADD COLUMN location_name VARCHAR(300) NULL`);
        console.log('  ✅ reviews.location_name added');
    }
    if (!reviewCols.includes('comments_count')) {
        await db.query(`ALTER TABLE reviews ADD COLUMN comments_count INT DEFAULT 0`);
        console.log('  ✅ reviews.comments_count added');
    }

    // 4. Add analytics tracking fields
    const analyticsCols = await db.query('DESCRIBE analytics').then(([r]) => r.map(c => c.Field));
    if (!analyticsCols.includes('page_url')) {
        await db.query(`ALTER TABLE analytics ADD COLUMN page_url VARCHAR(500) NULL`);
        console.log('  ✅ analytics.page_url added');
    }
    if (!analyticsCols.includes('user_agent')) {
        await db.query(`ALTER TABLE analytics ADD COLUMN user_agent VARCHAR(500) NULL`);
        console.log('  ✅ analytics.user_agent added');
    }
    if (!analyticsCols.includes('duration_ms')) {
        await db.query(`ALTER TABLE analytics ADD COLUMN duration_ms INT DEFAULT 0`);
        console.log('  ✅ analytics.duration_ms added');
    }
    if (!analyticsCols.includes('ip_address')) {
        await db.query(`ALTER TABLE analytics ADD COLUMN ip_address VARCHAR(45) NULL`);
        console.log('  ✅ analytics.ip_address added');
    }

    // 5. Seed default events if empty
    const [evtCount] = await db.query('SELECT COUNT(*) as c FROM events');
    if (evtCount[0].c === 0) {
        const { v4: uuid } = require('uuid');
        await db.query(`INSERT INTO events (id, title, description, season, event_date, location, is_featured, is_active) VALUES
            (?, 'Lễ hội Mai Vàng Bình Lợi', 'Ngắm hàng trăm gốc mai cổ thụ khoe sắc, trải nghiệm tết cổ truyền miền Tây ngay giữa Sài Gòn.', 'spring', '2026-02-01 08:00:00', 'Làng nghề Mai Vàng', 1, 1),
            (?, 'Đêm Hoa Đăng Chữa Lành', 'Thả hoa đăng trên sông, nghe nhạc acoustic bên hồ, thiền định và yoga chữa lành tâm hồn.', 'autumn', '2026-09-15 18:00:00', 'Hồ sen Bình Lợi', 1, 1),
            (?, 'Ngày hội Miệt Vườn', 'Đạp xe xuyên rừng, trải nghiệm hái dừa, chèo ghe trên sông, và thưởng thức ẩm thực miền Tây.', 'summer', '2026-07-01 07:00:00', 'Toàn xã Bình Lợi', 1, 1)
        `, [uuid(), uuid(), uuid()]);
        console.log('  ✅ Default events seeded');
    }

    // 6. Seed default seasonal experiences if empty
    const [seCount] = await db.query('SELECT COUNT(*) as c FROM seasonal_experiences');
    if (seCount[0].c === 0) {
        const { v4: uuid } = require('uuid');
        await db.query(`INSERT INTO seasonal_experiences (id, title, description, icon, icon_color, season, sort_order) VALUES
            (?, 'Mai Vàng Khoe Sắc', 'Làng nghề truyền thống và xin lộc đầu năm.', 'bi-flower1', 'warning', 'spring', 1),
            (?, 'Miệt Vườn Xanh Mát', 'Đạp xe xuyên rừng, trải nghiệm hái dừa.', 'bi-bicycle', 'success', 'summer', 2),
            (?, 'Đêm Hoa Đăng Chữa Lành', 'Acoustic bên hồ, thả hoa đăng cầu bình an.', 'bi-stars', 'danger', 'autumn', 3),
            (?, 'Ấm Áp Bên Bếp Lửa', 'Học nấu bánh dân gian, nghe kể chuyện làng.', 'bi-cup-hot', 'info', 'winter', 4)
        `, [uuid(), uuid(), uuid(), uuid()]);
        console.log('  ✅ Default seasonal experiences seeded');
    }

    console.log('\n✅ Migration v2 completed!');
    process.exit(0);
}

migrate().catch(e => { console.error('Migration failed:', e); process.exit(1); });
