const db = require('../src/core/database');

async function migrateAll() {
    try {
        console.log('🚀 Bắt đầu Migration toàn bộ hệ thống...\n');

        // ===== 1. WORKSHOPS (Chương 5.11) =====
        await db.query(`
            CREATE TABLE IF NOT EXISTS workshops (
                id VARCHAR(36) PRIMARY KEY,
                destination_id VARCHAR(36),
                title VARCHAR(255) NOT NULL,
                description TEXT,
                type ENUM('nhang','mai','thien','banh','ecology','culture','other') DEFAULT 'other',
                price INT DEFAULT 0,
                max_participants INT DEFAULT 20,
                duration_minutes INT DEFAULT 60,
                schedule_note VARCHAR(500),
                image VARCHAR(500),
                is_active BOOLEAN DEFAULT TRUE,
                sort_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_dest (destination_id),
                INDEX idx_type (type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng workshops');

        // ===== 2. WORKSHOP BOOKINGS =====
        await db.query(`
            CREATE TABLE IF NOT EXISTS workshop_bookings (
                id VARCHAR(36) PRIMARY KEY,
                workshop_id VARCHAR(36),
                user_id VARCHAR(36),
                booking_date DATE NOT NULL,
                booking_time TIME,
                num_people INT DEFAULT 1,
                total_price INT DEFAULT 0,
                qr_ticket VARCHAR(500),
                status ENUM('pending','confirmed','completed','cancelled') DEFAULT 'pending',
                note TEXT,
                rating INT,
                review TEXT,
                review_images JSON,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_workshop (workshop_id),
                INDEX idx_user (user_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng workshop_bookings');

        // ===== 3. REVIEWS (Chương 5.13) =====
        await db.query(`
            CREATE TABLE IF NOT EXISTS reviews (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                destination_id VARCHAR(36),
                content TEXT,
                rating INT DEFAULT 5,
                images JSON,
                video_url VARCHAR(500),
                likes_count INT DEFAULT 0,
                is_featured BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_dest (destination_id),
                INDEX idx_featured (is_featured)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng reviews');

        await db.query(`
            CREATE TABLE IF NOT EXISTS review_likes (
                id VARCHAR(36) PRIMARY KEY,
                review_id VARCHAR(36),
                user_id VARCHAR(36),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_like (review_id, user_id),
                INDEX idx_review (review_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng review_likes');

        await db.query(`
            CREATE TABLE IF NOT EXISTS review_comments (
                id VARCHAR(36) PRIMARY KEY,
                review_id VARCHAR(36),
                user_id VARCHAR(36),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_review (review_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng review_comments');

        // ===== 4. REWARDS (Chương 5.15) =====
        await db.query(`
            CREATE TABLE IF NOT EXISTS rewards (
                id VARCHAR(36) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                points_required INT DEFAULT 100,
                type ENUM('voucher','workshop','gift','special') DEFAULT 'voucher',
                image VARCHAR(500),
                quantity INT DEFAULT 100,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng rewards');

        await db.query(`
            CREATE TABLE IF NOT EXISTS user_rewards (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                reward_id VARCHAR(36),
                redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status ENUM('active','used','expired') DEFAULT 'active',
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng user_rewards');

        // ===== 5. CART & ORDERS (Chương 5.12) =====
        await db.query(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                product_id VARCHAR(36),
                quantity INT DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng cart_items');

        await db.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                items JSON,
                total_amount INT DEFAULT 0,
                status ENUM('pending','confirmed','ready','completed','cancelled') DEFAULT 'pending',
                pickup_location VARCHAR(255),
                note TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng orders');

        // ===== 6. NOTIFICATIONS (Chương 5.14) =====
        await db.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                type ENUM('festival','workshop','stamp','voucher','reminder','system') DEFAULT 'system',
                title VARCHAR(255),
                message TEXT,
                link VARCHAR(500),
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_user (user_id),
                INDEX idx_read (is_read)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ Bảng notifications');

        // ===== 7. SEED WORKSHOPS =====
        const { v4: uuidv4 } = require('uuid');
        const [dests] = await db.query('SELECT id, slug FROM destinations LIMIT 8');
        const destMap = {};
        dests.forEach(d => destMap[d.slug] = d.id);

        const workshopData = [
            {
                id: uuidv4(), destination_id: destMap['xuong-nhang-minh'] || dests[0]?.id,
                title: 'Workshop Se Nhang Truyền Thống',
                description: 'Trải nghiệm quy trình làm nhang thủ công truyền thống từ lá cây và thảo mộc tự nhiên. Bạn sẽ được hướng dẫn từng bước: pha bột nhang, se nhang, phơi khô và đóng gói.',
                type: 'nhang', price: 150000, max_participants: 15, duration_minutes: 90,
                schedule_note: 'T3-T7, 8:00-11:00 & 14:00-16:00', image: '/images/xuong-nhang-1.png'
            },
            {
                id: uuidv4(), destination_id: destMap['vuon-mai-binh-loi'] || dests[1]?.id,
                title: 'Workshop Chăm Sóc Mai Vàng',
                description: 'Học cách chăm sóc, uốn dáng và ghép cành mai vàng cùng nghệ nhân hơn 20 năm kinh nghiệm. Hiểu về văn hóa mai Tết miền Nam.',
                type: 'mai', price: 200000, max_participants: 10, duration_minutes: 120,
                schedule_note: 'T4-CN, 7:00-10:00', image: '/images/vuon-mai-1.png'
            },
            {
                id: uuidv4(), destination_id: destMap['chua-phap-tang'] || dests[2]?.id,
                title: 'Thiền Healing Buổi Sáng',
                description: 'Trải nghiệm 60 phút thiền tĩnh lặng tại chùa cổ. Hướng dẫn bởi sư thầy: thiền hơi thở, thiền hành, mindfulness. Kết thúc bằng trà thiền.',
                type: 'thien', price: 0, max_participants: 25, duration_minutes: 60,
                schedule_note: 'Hàng ngày, 5:30-6:30', image: '/images/chua-phap-tang-1.png'
            },
            {
                id: uuidv4(), destination_id: dests[3]?.id,
                title: 'Workshop Làm Bánh Dân Gian',
                description: 'Tự tay làm bánh tét, bánh ít trần, bánh da lợn theo công thức gia truyền. Trải nghiệm không khí làng quê Nam Bộ.',
                type: 'banh', price: 180000, max_participants: 12, duration_minutes: 120,
                schedule_note: 'T6-CN, 9:00-11:00', image: '/images/hero-2.png'
            }
        ];

        for (const ws of workshopData) {
            const [existing] = await db.query('SELECT id FROM workshops WHERE title = ?', [ws.title]);
            if (existing.length === 0) {
                await db.query(
                    `INSERT INTO workshops (id, destination_id, title, description, type, price, max_participants, duration_minutes, schedule_note, image) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [ws.id, ws.destination_id, ws.title, ws.description, ws.type, ws.price, ws.max_participants, ws.duration_minutes, ws.schedule_note, ws.image]
                );
            }
        }
        console.log('✅ Seed 4 workshops');

        // ===== 8. SEED REWARDS =====
        const rewardsData = [
            { id: uuidv4(), title: 'Voucher Workshop Miễn Phí', description: 'Tham gia 1 workshop bất kỳ miễn phí', points_required: 500, type: 'workshop' },
            { id: uuidv4(), title: 'Trà Sen Bình Lợi', description: 'Hộp trà sen thủ công từ làng nghề', points_required: 300, type: 'gift' },
            { id: uuidv4(), title: 'Giảm 50% Combo OCOP', description: 'Giảm 50% khi mua combo sản phẩm OCOP', points_required: 200, type: 'voucher' },
            { id: uuidv4(), title: 'Nhang Thảo Mộc Premium', description: 'Bộ nhang thảo mộc cao cấp từ Xưởng Nhang Minh', points_required: 400, type: 'gift' }
        ];

        for (const r of rewardsData) {
            const [existing] = await db.query('SELECT id FROM rewards WHERE title = ?', [r.title]);
            if (existing.length === 0) {
                await db.query(
                    `INSERT INTO rewards (id, title, description, points_required, type) VALUES (?, ?, ?, ?, ?)`,
                    [r.id, r.title, r.description, r.points_required, r.type]
                );
            }
        }
        console.log('✅ Seed 4 rewards');

        console.log('\n🎉 MIGRATION TOÀN BỘ HOÀN TẤT!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Migration Error:', e.message);
        process.exit(1);
    }
}

migrateAll();
