const db = require('./src/core/database');
const { v4: uuidv4 } = require('uuid');

async function testComment() {
    try {
        const [reviews] = await db.query('SELECT id FROM reviews LIMIT 1');
        if (reviews.length === 0) {
            console.log("No reviews found");
            process.exit(0);
        }
        const reviewId = reviews[0].id;
        const commentId = uuidv4();
        console.log("Testing insert comment for reviewId:", reviewId);
        
        await db.query(
            'INSERT INTO review_comments (id, review_id, user_id, guest_uuid, content, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
            [commentId, reviewId, null, 'test-guest-uuid', 'Bình luận thử nghiệm mượt mà! 🌟']
        );
        await db.query('UPDATE reviews SET comments_count = comments_count + 1 WHERE id = $1', [reviewId]);

        const [comments] = await db.query('SELECT * FROM review_comments WHERE id = $1', [commentId]);
        console.log("SUCCESS! Created comment:", comments[0]);

    } catch(e) {
        console.error("Test comment FAILED:", e);
    }
    process.exit(0);
}

testComment();
