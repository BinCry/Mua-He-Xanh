const db = require('../core/database');

async function run() {
    console.log('🔄 Starting destination seasons update...');
    try {
        const updates = [
            { slug: 'vuon-mai', seasons: '["spring"]' },
            { slug: 'lang-nghe-nhang-truyen-thong', seasons: '["spring","autumn"]' },
            { slug: 'chua-thanh-tam', seasons: '["spring","autumn","winter"]' },
            { slug: 'vuon-dua', seasons: '["summer"]' },
            { slug: 'vuon-lan', seasons: '["summer","winter"]' },
            { slug: 'cong-vien-van-hoa-lang-le', seasons: '["summer","autumn"]' },
            { slug: 'rung-phong-ho', seasons: '["summer","winter"]' },
            { slug: 'cau-chu-u', seasons: '["summer","autumn","winter"]' },
            { slug: 'chua-phap-tang', seasons: '["spring","autumn"]' },
            { slug: 'dinh-go-xoai', seasons: '["spring","autumn"]' }
        ];

        for (const item of updates) {
            const [result] = await db.query(
                'UPDATE destinations SET seasons = ? WHERE slug = ?',
                [item.seasons, item.slug]
            );
            console.log(`  Updated ${item.slug}: affected ${result.affectedRows} rows`);
        }

        console.log('✅ Destination seasons update completed successfully!');
        process.exit(0);
    } catch (e) {
        console.error('❌ Failed to update seasons:', e);
        process.exit(1);
    }
}

run();
