/**
 * Migration V3 — Seasonal Journey Templates
 * Run: node src/scripts/migrate_v3.js
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

async function migrate() {
    console.log('🔄 Starting migration v3...');

    // 1. Create seasonal_journey_templates table
    await db.query(`
        CREATE TABLE IF NOT EXISTS seasonal_journey_templates (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(300) NOT NULL,
            description TEXT,
            season ENUM('spring','summer','autumn','winter') NOT NULL,
            interest ENUM('chill','peace','culture','family') NOT NULL,
            stops TEXT NOT NULL, -- JSON string array of destination IDs
            duration VARCHAR(100) DEFAULT 'full_day',
            km DECIMAL(5,2) DEFAULT 5.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `).then(() => console.log('  ✅ seasonal_journey_templates table created'))
      .catch(e => console.log('  ⚠️ seasonal_journey_templates:', e.message));

    // 2. Fetch destination slugs to map correct IDs
    const [dests] = await db.query('SELECT id, slug FROM destinations');
    const destMap = {};
    dests.forEach(d => { destMap[d.slug] = d.id; });

    // Helper to get ID or return a placeholder
    const getDestId = (slug) => destMap[slug] || 'placeholder-id';

    // Check if empty before seeding
    const [countRow] = await db.query('SELECT COUNT(*) as c FROM seasonal_journey_templates');
    if (countRow[0].c === 0) {
        // Prepare seed data
        const springStops = [getDestId('lang-mai-vang'), getDestId('xuong-nhang-minh'), getDestId('chua-thanh-tam')].filter(id => id !== 'placeholder-id');
        const summerStops = [getDestId('vuon-dua'), getDestId('xuong-nhang-minh'), getDestId('cong-vien-lang-le')].filter(id => id !== 'placeholder-id');
        const autumnStops = [getDestId('chua-phap-tang'), getDestId('chua-thanh-tam'), getDestId('cong-vien-lang-le')].filter(id => id !== 'placeholder-id');
        const winterStops = [getDestId('rung-phong-ho'), getDestId('vuon-lan'), getDestId('cau-chu-z')].filter(id => id !== 'placeholder-id');

        const templates = [
            {
                id: uuidv4(),
                name: 'Du Xuân Đất Tổ Bình Lợi',
                description: 'Hành trình ngắm mai vàng nở rộ, viếng chùa thắp hương cầu an lành đầu xuân và ghé xưởng nhang truyền thống.',
                season: 'spring',
                interest: 'culture',
                stops: JSON.stringify(springStops),
                duration: 'full_day',
                km: 4.8
            },
            {
                id: uuidv4(),
                name: 'Hè Về Miệt Vườn Lộng Gió',
                description: 'Thư giãn bên vườn dừa rợp bóng mát, hái quả trải nghiệm cuộc sống dân dã và đạp xe quanh công viên sinh thái.',
                season: 'summer',
                interest: 'chill',
                stops: JSON.stringify(summerStops),
                duration: 'half_day',
                km: 3.5
            },
            {
                id: uuidv4(),
                name: 'Thu Về Chữa Lành Thân Tâm',
                description: 'Lộ trình tâm linh tĩnh lặng qua chùa Pháp Tạng, thắp nến hoa đăng thanh tịnh tâm hồn dịp Trung Thu.',
                season: 'autumn',
                interest: 'peace',
                stops: JSON.stringify(autumnStops),
                duration: 'full_day',
                km: 5.2
            },
            {
                id: uuidv4(),
                name: 'Ấm Áp Hành Trình Gia Đình',
                description: 'Khám phá rừng phòng hộ ngập mặn xanh rì, vườn lan rực rỡ và check-in hoàng hôn lãng mạn tại Cầu chữ Z.',
                season: 'winter',
                interest: 'family',
                stops: JSON.stringify(winterStops),
                duration: 'half_day',
                km: 6.1
            }
        ];

        for (let t of templates) {
            if (JSON.parse(t.stops).length > 0) {
                await db.query(`
                    INSERT INTO seasonal_journey_templates (id, name, description, season, interest, stops, duration, km)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [t.id, t.name, t.description, t.season, t.interest, t.stops, t.duration, t.km]);
            }
        }
        console.log('  ✅ Default seasonal journey templates seeded');
    }

    console.log('\n✅ Migration v3 completed!');
    process.exit(0);
}

migrate().catch(e => { console.error('Migration failed:', e); process.exit(1); });
