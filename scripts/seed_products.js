const mysql = require('mysql2/promise');
const config = require('../src/config/env');
const { v4: uuidv4 } = require('uuid');

(async () => {
    try {
        const db = await mysql.createConnection({
            host: config.db.host,
            user: config.db.user,
            password: config.db.pass,
            database: config.db.name,
            port: config.db.port,
            ssl: config.db.ssl ? { rejectUnauthorized: false } : null
        });

        console.log("Seeding OCOP Products...");

        const products = [
            {
                name: 'Mai Vàng Bình Lợi (Gốc Bonsai)',
                price: 1500000,
                description: 'Cây mai vàng nguyên thủy Bình Lợi, dáng thế đẹp, nụ dày, hoa 5-12 cánh rực rỡ.',
                image: '/images/product-mai-1.png',
                category: 'Cây cảnh'
            },
            {
                name: 'Rượu Mai Đặc Sản',
                price: 250000,
                description: 'Rượu được ngâm từ hoa mai và thảo mộc thiên nhiên, giúp an thần, ngủ ngon.',
                image: '/images/product-wine-1.png',
                category: 'Thực phẩm'
            },
            {
                name: 'Nhang Thảo Mộc Lê Minh Xuân',
                price: 45000,
                description: 'Nhang sạch làm từ bột gỗ và quế, không hóa chất, mùi hương dịu nhẹ.',
                image: '/images/product-incense-1.png',
                category: 'Thủ công'
            },
            {
                name: 'Mật Ong Hoa Tràm',
                price: 180000,
                description: 'Mật ong nguyên chất từ rừng phòng hộ, giàu dinh dưỡng và khoáng chất.',
                image: '/images/product-honey-1.png',
                category: 'Thực phẩm'
            }
        ];

        for (const p of products) {
            await db.query(
                "INSERT INTO products (id, name, price, description, image, category, rating, sold, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE price=VALUES(price)",
                [uuidv4(), p.name, p.price, p.description, p.image, p.category, 4.8, Math.floor(Math.random() * 100)]
            );
        }

        console.log("OCOP Products seeded!");
        process.exit(0);
    } catch (err) {
        console.error("Seed error:", err);
        process.exit(1);
    }
})();
