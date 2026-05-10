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

        console.log("Seeding Festivals...");

        const festivals = [
            {
                name: 'Lễ Hội Mai Vàng Bình Lợi 2026',
                date: '2026-01-20',
                description: 'Sự kiện thường niên lớn nhất tôn vinh nghề trồng mai vàng truyền thống. Trưng bày hàng trăm gốc mai bonsai tuyệt đẹp, chợ Tết quê và các hoạt động văn hóa dân gian.',
                image: '/images/hero-2.png',
                status: 'upcoming'
            },
            {
                name: 'Ngày Hội Nông Sản Xanh',
                date: '2026-06-15',
                description: 'Gặp gỡ những người nông dân địa phương, trải nghiệm thu hoạch trái cây, thưởng thức đặc sản tươi sống và tham gia workshop làm nông.',
                image: '/images/hero-1.png',
                status: 'upcoming'
            },
            {
                name: 'Đêm Nhạc Giao Thừa Láng Le',
                date: '2026-02-16',
                description: 'Chương trình nghệ thuật đặc biệt kết hợp giao lưu văn hóa, bắn pháo hoa nghệ thuật và cầu bình an đầu năm tại khu di tích.',
                image: '/images/hero-3.png',
                status: 'upcoming'
            }
        ];

        for (const f of festivals) {
            await db.query(
                "INSERT INTO festivals (id, name, date, description, image, status) VALUES (?, ?, ?, ?, ?, ?)",
                [uuidv4(), f.name, f.date, f.description, f.image, f.status]
            );
        }

        console.log("Festivals seeded!");
        process.exit(0);
    } catch (err) {
        console.error("Seed error:", err);
        process.exit(1);
    }
})();
