const db = require('./src/core/database');

async function checkCounts() {
    try {
        const [rows] = await db.query(`
            SELECT r.id, r.content, r.likes_count, r.comments_count,
                   (SELECT COUNT(*) FROM review_likes WHERE review_id = r.id) as real_likes,
                   (SELECT COUNT(*) FROM review_comments WHERE review_id = r.id) as real_comments
            FROM reviews r
            ORDER BY r.created_at DESC
            LIMIT 10
        `);
        console.log("=== REVIEWS DATA ===");
        console.log(rows);
    } catch(e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

checkCounts();
