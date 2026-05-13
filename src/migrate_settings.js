const db = require('./core/database');

(async () => {
    try {
        console.log("Connected to database. Creating settings table...");

        await db.query(`
            CREATE TABLE IF NOT EXISTS settings (
                key_name VARCHAR(100) PRIMARY KEY,
                key_value TEXT,
                category VARCHAR(50) DEFAULT 'general',
                description TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);

        const initialSettings = [
            { key: 'home_hero_spring_title', val: 'Xuân Bình Lợi – Sắc Mai Vàng', cat: 'home' },
            { key: 'home_hero_spring_slogan', val: 'Hồn quê giữa thành phố mới', cat: 'home' },
            { key: 'home_hero_spring_video', val: '/videos/spring_mai.mp4', cat: 'home' },
            { key: 'home_hero_summer_title', val: 'Bình Lợi – Miền Tây giữa lòng Sài Gòn', cat: 'home' },
            { key: 'home_hero_summer_slogan', val: 'Miệt vườn giữa phố, trải nghiệm bản sắc', cat: 'home' },
            { key: 'home_hero_summer_video', val: '/videos/summer_healing.mp4', cat: 'home' },
            { key: 'home_hero_autumn_title', val: 'Mùa Hoa Đăng – Bình Lợi Chữa Lành', cat: 'home' },
            { key: 'home_hero_autumn_slogan', val: 'Bình từ tâm – Lợi từ tầm', cat: 'home' },
            { key: 'home_hero_autumn_video', val: '/videos/autumn_healing.mp4', cat: 'home' },
            { key: 'home_stats_visitors', val: '18500', cat: 'stats' },
            { key: 'home_stats_checkins_offset', val: '5240', cat: 'stats' }
        ];

        for (const s of initialSettings) {
            await db.query(
                "INSERT INTO settings (key_name, key_value, category) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_value = ?",
                [s.key, s.val, s.cat, s.val]
            );
        }

        console.log("Settings table created and seeded successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration error:", err);
        process.exit(1);
    }
})();
