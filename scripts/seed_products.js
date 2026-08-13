const db = require('../src/core/database');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    console.log('Seeding products...');
    const products = [
        {
            id: uuidv4(),
            title: 'Tổ Yến Chưng Đông Trùng Hạ Thảo (Hộp 6+2 hũ 70ml)',
            description: '12g tổ yến tươi/hũ — OCOP 4 Sao TP.HCM',
            type: 'ecology',
            price: 1029000,
            max_participants: 50,
            duration: 'Hộp 8 hũ x 70ml',
            image: '/images/hero-2.png',
            is_active: 1
        },
        {
            id: uuidv4(),
            title: 'Tổ Yến Sạch Ép Khuôn Cao Cấp (Hộp 50g)',
            description: '100% yến sạch nguyên chất, OCOP 4 Sao TP.HCM',
            type: 'ecology',
            price: 2680000,
            max_participants: 30,
            duration: 'Hộp 50 gram',
            image: '/images/hero-2.png',
            is_active: 1
        },
        {
            id: uuidv4(),
            title: 'Cháo Tổ Yến Thịt Bò (Gói 50g)',
            description: 'Giàu protein, 18 loại axit amin dưỡng chất',
            type: 'banh',
            price: 11000,
            max_participants: 100,
            duration: 'Gói 50g',
            image: '/images/hero-2.png',
            is_active: 1
        },
        {
            id: uuidv4(),
            title: 'Thạch Yến Mật Dừa Nước (Túi 240g)',
            description: '12 gói x 20g, tăng cường đề kháng tự nhiên',
            type: 'culture',
            price: 98000,
            max_participants: 80,
            duration: 'Túi 240g (12 gói x 20g)',
            image: '/images/hero-2.png',
            is_active: 1
        },
        {
            id: uuidv4(),
            title: 'Nhang Thảo Mộc Bình Lợi (Hộp 100 Nụ)',
            description: '100% thảo mộc tự nhiên làng nghề truyền thống Bình Lợi',
            type: 'nhang',
            price: 150000,
            max_participants: 60,
            duration: 'Hộp 100 nụ',
            image: '/images/hero-2.png',
            is_active: 1
        },
        {
            id: uuidv4(),
            title: 'Mai Vàng Bình Lợi Dáng Cảnh Chữa Lành',
            description: 'Mai vàng Bình Lợi dáng thế đẹp, sắc hoa nở rực rỡ',
            type: 'mai',
            price: 850000,
            max_participants: 20,
            duration: 'Chậu dáng cảnh',
            image: '/images/hero-2.png',
            is_active: 1
        }
    ];

    for (const p of products) {
        await db.query(
            `INSERT INTO workshops (id, title, description, type, price, max_participants, duration, image, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
            [p.id, p.title, p.description, p.type, p.price, p.max_participants, p.duration, p.image, p.is_active]
        );
    }
    console.log('Successfully seeded products!');
    process.exit(0);
}

seed().catch(e => { console.error('Seed error:', e); process.exit(1); });
