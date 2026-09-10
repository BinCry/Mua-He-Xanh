const db = require('../src/core/database');

async function migrate() {
    console.log('--- Creating Studio Tables ---');
    try {
        await db.query(`
            CREATE TABLE IF NOT EXISTS video_templates (
                id SERIAL PRIMARY KEY,
                template_id VARCHAR(50) UNIQUE NOT NULL,
                title VARCHAR(150) NOT NULL,
                category VARCHAR(50) DEFAULT 'healing',
                badge VARCHAR(50) DEFAULT 'Hot',
                aspect_ratio VARCHAR(10) DEFAULT '9:16',
                duration INT DEFAULT 15,
                slots_count INT DEFAULT 5,
                thumbnail VARCHAR(255),
                audio_url VARCHAR(255),
                audio_title VARCHAR(150),
                config JSONB DEFAULT '{}',
                is_published BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ video_templates table ready');

        await db.query(`
            CREATE TABLE IF NOT EXISTS studio_projects (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(200) DEFAULT 'Dự án chưa đặt tên',
                aspect_ratio VARCHAR(10) DEFAULT '9:16',
                duration FLOAT DEFAULT 15,
                project_data JSONB NOT NULL,
                thumbnail VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✓ studio_projects table ready');

        // Seed default templates if empty
        const [existing] = await db.query('SELECT COUNT(*) as count FROM video_templates');
        if (parseInt(existing[0].count, 10) === 0) {
            const templates = [
                {
                    template_id: 'tpl-healing',
                    title: 'Chữa Lành Bình Lợi',
                    category: 'healing',
                    badge: 'Phổ biến',
                    aspect_ratio: '9:16',
                    duration: 15,
                    slots_count: 5,
                    thumbnail: '/images/cung-yen-lan-toa.jpg',
                    audio_url: '/media/audio_dest_1773041530737.mp3',
                    audio_title: 'Tiếng Chuông Gió & Suối Chảy',
                    config: JSON.stringify({
                        slots: [
                            { id: 1, label: 'Cảnh 1: Khởi đầu an yên', duration: 3.0, transition: 'fade', text: 'Bình Lợi - Nơi tâm hồn được nghỉ ngơi' },
                            { id: 2, label: 'Cảnh 2: Hàng mai xanh biếc', duration: 3.0, transition: 'slide', text: 'Sắc xanh dịu mát ven đường quê' },
                            { id: 3, label: 'Cảnh 3: Đầm sen bát ngát', duration: 3.0, transition: 'zoom', text: 'Hương sen thanh khiết sớm mai' },
                            { id: 4, label: 'Cảnh 4: Khoảnh khắc hoàng hôn', duration: 3.0, transition: 'fade', text: 'Ánh tà dương buông nhẹ trên dòng sông' },
                            { id: 5, label: 'Cảnh 5: Trở về với an nhiên', duration: 3.0, transition: 'fade', text: 'Hẹn gặp lại tại Bình Lợi Healing' }
                        ]
                    })
                },
                {
                    template_id: 'tpl-vlog-sen',
                    title: 'Vlog Đầm Sen Tam Đa',
                    category: 'vlog',
                    badge: 'Nổi bật',
                    aspect_ratio: '9:16',
                    duration: 20,
                    slots_count: 5,
                    thumbnail: '/images/Poster 1.jpg',
                    audio_url: '/media/audio_dest_1773041530737.mp3',
                    audio_title: 'Gió Mát Đồng Quê',
                    config: JSON.stringify({
                        slots: [
                            { id: 1, label: 'Cảnh 1: Đến đầm sen', duration: 4.0, transition: 'zoom', text: 'Check-in Đầm Sen Tam Đa cực chill' },
                            { id: 2, label: 'Cảnh 2: Cận cảnh búp sen', duration: 4.0, transition: 'fade', text: 'Từng cánh sen e ấp đón bình minh' },
                            { id: 3, label: 'Cảnh 3: Cầu gỗ bắc ngang', duration: 4.0, transition: 'slide', text: 'Đi dạo giữa ngát hương đồng cỏ' },
                            { id: 4, label: 'Cảnh 4: Thưởng trà sen ấm', duration: 4.0, transition: 'wipe', text: 'Hương vị trà thanh mát dịu lòng' },
                            { id: 5, label: 'Cảnh 5: Tạm biệt hoàng hôn', duration: 4.0, transition: 'fade', text: 'Bình Lợi Studio • Lưu giữ kỷ niệm' }
                        ]
                    })
                },
                {
                    template_id: 'tpl-mai-vang',
                    title: 'Sắc Vàng Làng Mai',
                    category: 'vlog',
                    badge: 'Mới',
                    aspect_ratio: '9:16',
                    duration: 15,
                    slots_count: 4,
                    thumbnail: '/images/Poster 2.jpg',
                    audio_url: '/media/audio_dest_1773041530737.mp3',
                    audio_title: 'Mùa Hoa Nở Rộ',
                    config: JSON.stringify({
                        slots: [
                            { id: 1, label: 'Cảnh 1: Lối vào làng mai', duration: 4.0, transition: 'fade', text: 'Về thủ phủ mai vàng Bình Lợi' },
                            { id: 2, label: 'Cảnh 2: Bàn tay nghệ nhân', duration: 3.5, transition: 'slide', text: 'Nét uốn tỉa công phu đậm sắc xuân' },
                            { id: 3, label: 'Cảnh 3: Rực rỡ vườn mai', duration: 4.0, transition: 'zoom', text: 'Bạt ngàn những gốc mai cổ thụ' },
                            { id: 4, label: 'Cảnh 4: Khung cảnh bình yên', duration: 3.5, transition: 'fade', text: 'Bình Lợi Healing • Nét đẹp muôn màu' }
                        ]
                    })
                },
                {
                    template_id: 'tpl-food',
                    title: 'Ẩm Thực Quê Nhà',
                    category: 'food',
                    badge: 'Món ngon',
                    aspect_ratio: '9:16',
                    duration: 16,
                    slots_count: 4,
                    thumbnail: '/images/Poster 3.jpg',
                    audio_url: '/media/audio_dest_1773041530737.mp3',
                    audio_title: 'Hương Vị Quê Hương',
                    config: JSON.stringify({
                        slots: [
                            { id: 1, label: 'Cảnh 1: Gian bếp quê', duration: 4.0, transition: 'fade', text: 'Hôm nay ăn gì ở Bình Lợi?' },
                            { id: 2, label: 'Cảnh 2: Nguyên liệu tươi sạch', duration: 4.0, transition: 'slide', text: 'Rau vườn cá sông tươi rói' },
                            { id: 3, label: 'Cảnh 3: Mâm cơm thơm nức', duration: 4.0, transition: 'zoom', text: 'Vị đậm đà gợi nhớ tuổi thơ' },
                            { id: 4, label: 'Cảnh 4: Nụ cười thân thương', duration: 4.0, transition: 'fade', text: 'Ghé Bình Lợi thưởng thức ngay nhé!' }
                        ]
                    })
                },
                {
                    template_id: 'tpl-culture-dinh',
                    title: 'Ký Ức Đình Bình Trường',
                    category: 'culture',
                    badge: 'Di tích',
                    aspect_ratio: '16:9',
                    duration: 24,
                    slots_count: 6,
                    thumbnail: '/images/Poster 4.jpg',
                    audio_url: '/media/audio_dest_1773041530737.mp3',
                    audio_title: 'Thanh Âm Cổ Kính',
                    config: JSON.stringify({
                        slots: [
                            { id: 1, label: 'Cảnh 1: Cổng đình rêu phong', duration: 4.0, transition: 'fade', text: 'Đình Bình Trường - Di sản trăm năm' },
                            { id: 2, label: 'Cảnh 2: Mái ngói cong vút', duration: 4.0, transition: 'slide', text: 'Kiến trúc Nam Bộ trường tồn' },
                            { id: 3, label: 'Cảnh 3: Cột gỗ chạm khắc', duration: 4.0, transition: 'fade', text: 'Nghệ thuật chạm trổ tinh xảo' },
                            { id: 4, label: 'Cảnh 4: Khói trầm bảng lảng', duration: 4.0, transition: 'zoom', text: 'Không gian tĩnh mịch linh thiêng' },
                            { id: 5, label: 'Cảnh 5: Giếng ngọc sân đình', duration: 4.0, transition: 'slide', text: 'Ký ức ngàn xưa đọng lại' },
                            { id: 6, label: 'Cảnh 6: Toàn cảnh di tích', duration: 4.0, transition: 'fade', text: 'Bình Lợi Healing • Tự hào di sản quê hương' }
                        ]
                    })
                }
            ];

            for (const t of templates) {
                await db.query(`
                    INSERT INTO video_templates (template_id, title, category, badge, aspect_ratio, duration, slots_count, thumbnail, audio_url, audio_title, config)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    ON CONFLICT (template_id) DO UPDATE SET
                        title = EXCLUDED.title,
                        category = EXCLUDED.category,
                        badge = EXCLUDED.badge,
                        aspect_ratio = EXCLUDED.aspect_ratio,
                        duration = EXCLUDED.duration,
                        slots_count = EXCLUDED.slots_count,
                        thumbnail = EXCLUDED.thumbnail,
                        audio_url = EXCLUDED.audio_url,
                        audio_title = EXCLUDED.audio_title,
                        config = EXCLUDED.config,
                        updated_at = CURRENT_TIMESTAMP
                `, [t.template_id, t.title, t.category, t.badge, t.aspect_ratio, t.duration, t.slots_count, t.thumbnail, t.audio_url, t.audio_title, t.config]);
            }
            console.log('✓ Initial 5 video templates seeded');
        } else {
            console.log(`ℹ video_templates already has ${existing[0].count} entries`);
        }
        console.log('--- Migration completed successfully ---');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
