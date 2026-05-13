const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    try {
        const db = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            ssl: { rejectUnauthorized: false }
        });

        console.log("Connected to database. Seeding real content...");

        const destinations = [
            {
                name: 'Chùa Pháp Tạng',
                slug: 'chua-phap-tang',
                type: 'temple',
                short_desc: 'Ngôi chùa thanh tịnh với kiến trúc nghệ thuật đặc sắc.',
                story: 'Chùa Pháp Tạng tọa lạc tại xã Lê Minh Xuân, huyện Bình Chánh, là một trong những điểm đến tâm linh nổi tiếng nhất khu vực. Ngôi chùa không chỉ là nơi chiêm bái của Phật tử mà còn là không gian chữa lành tâm hồn với vườn thiền và tiếng chuông chùa vang vọng. Mỗi góc nhỏ tại chùa đều mang một thông điệp về sự an nhiên và lòng nhân ái.',
                highlight: 'Tham gia khóa thiền trà và nghe thuyết pháp từ Thầy Thích Trí Huệ.',
                cover_image: '/images/chua-phap-tang-1.png',
                open_hours: '06:00 - 21:00',
                cost: 'Miễn phí',
                best_time: 'Sáng sớm hoặc chiều tối',
                points: 150,
                lat: 10.7423,
                lng: 106.5312,
                moods: JSON.stringify(['an_nhien', 'thanh_loc']),
                seasons: 'spring, autumn'
            },
            {
                name: 'Xưởng Nhang Truyền Thống',
                slug: 'xuong-nhang-minh',
                type: 'craft',
                short_desc: 'Làng nghề nhang rực rỡ sắc màu di sản.',
                story: 'Làng nghề làm nhang tại Bình Lợi đã có tuổi đời hàng chục năm. Đến đây, du khách sẽ được tận mắt chứng kiến quy trình làm nhang thủ công, từ khâu trộn bột, se nhang đến phơi nhang dưới nắng mặt trời, tạo nên những dải lụa đỏ vàng rực rỡ khắp cả một vùng quê. Đây là nơi lưu giữ hơi thở của văn hóa truyền thống giữa lòng Sài Gòn hiện đại.',
                highlight: 'Trải nghiệm workshop tự tay se nhang và cảm nhận mùi hương thảo mộc.',
                cover_image: '/images/xuong-nhang-1.png',
                open_hours: '08:00 - 17:00',
                cost: '50.000đ - 100.000đ (bao gồm phí trải nghiệm)',
                best_time: 'Ngày nắng đẹp (để ngắm phơi nhang)',
                points: 200,
                lat: 10.7512,
                lng: 106.5423,
                moods: JSON.stringify(['trai_nghiem', 'kham_pha']),
                seasons: 'spring, summer'
            },
            {
                name: 'Vườn Mai Vàng Bình Lợi',
                slug: 'vuon-mai',
                type: 'nature',
                short_desc: 'Thủ phủ Mai Vàng lớn nhất TP.HCM.',
                story: 'Bình Lợi được mệnh danh là "Thủ phủ Mai Vàng" của miền Nam. Hàng nghìn gốc mai trải dài tít tắp tạo nên một khung cảnh thiên nhiên hùng vĩ nhưng cũng rất thơ mộng. Đặc biệt vào dịp Tết, cả vùng đất như khoác lên mình chiếc áo vàng rực rỡ, tượng trưng cho sự may mắn và thịnh vượng.',
                highlight: 'Chụp ảnh check-in giữa rừng mai bạt ngàn và chọn cho mình một gốc mai ưng ý.',
                cover_image: '/images/vuon-mai-1.png',
                open_hours: '07:00 - 18:00',
                cost: '20.000đ - 50.000đ (phí tham quan)',
                best_time: 'Tháng 12 âm lịch đến Tết Nguyên Đán',
                points: 250,
                lat: 10.7601,
                lng: 106.5512,
                moods: JSON.stringify(['an_nhien', 'kham_pha']),
                seasons: 'spring'
            },
            {
                name: 'Cầu Chữ U / Cầu Bình Lợi',
                slug: 'cau-chu-z',
                type: 'nature',
                short_desc: 'Điểm ngắm hoàng hôn cực phẩm ven sông.',
                story: 'Cầu chữ U tại Bình Lợi là một biểu tượng kiến trúc độc đáo, nơi giao thoa giữa nhịp sống hiện đại và nét yên bình của dòng sông xanh. Đây là địa điểm yêu thích của giới trẻ để ngắm nhìn hoàng hôn buông xuống, phản chiếu ánh sáng lung linh trên mặt nước, mang lại cảm giác bình yên đến lạ kỳ.',
                highlight: 'Ngắm hoàng hôn và tận hưởng làn gió mát lành từ dòng sông Sài Gòn.',
                cover_image: '/images/cau-chu-z-1.png',
                open_hours: 'Tự do',
                cost: 'Miễn phí',
                best_time: '17:00 - 18:30 (Hoàng hôn)',
                points: 100,
                lat: 10.7654,
                lng: 106.5621,
                moods: JSON.stringify(['an_nhien', 'thanh_loc']),
                seasons: 'summer, autumn'
            }
        ];

        for (const dest of destinations) {
            // Update or Insert
            const [existing] = await db.query("SELECT id FROM destinations WHERE slug = ?", [dest.slug]);
            if (existing.length > 0) {
                const id = existing[0].id;
                await db.query(
                    "UPDATE destinations SET name=?, type=?, short_desc=?, description=?, story=?, highlight=?, cover_image=?, open_hours=?, cost=?, best_time=?, points=?, lat=?, lng=?, moods=?, seasons=?, is_active=1 WHERE id=?",
                    [dest.name, dest.type, dest.short_desc, dest.story, dest.story, dest.highlight, dest.cover_image, dest.open_hours, dest.cost, dest.best_time, dest.points, dest.lat, dest.lng, dest.moods, dest.seasons, id]
                );
                console.log(`Updated: ${dest.name}`);
            } else {
                await db.query(
                    "INSERT INTO destinations (id, name, slug, type, short_desc, description, story, highlight, cover_image, open_hours, cost, best_time, points, lat, lng, moods, seasons, is_active, checkin_tip, map_x, map_y, qr_secret) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
                    [dest.name, dest.slug, dest.type, dest.short_desc, dest.story, dest.story, dest.highlight, dest.cover_image, dest.open_hours, dest.cost, dest.best_time, dest.points, dest.lat, dest.lng, dest.moods, dest.seasons, "Hãy chụp ảnh tại điểm này!", 50, 50, "SECURE_" + dest.slug.toUpperCase()]
                );
                console.log(`Inserted: ${dest.name}`);
            }
        }

        console.log("Seeding complete!");
        process.exit(0);
    } catch (err) {
        console.error("Seeding error:", err);
        process.exit(1);
    }
})();
