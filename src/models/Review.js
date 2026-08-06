const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

class Review {
    static async getByDestination(destinationId, limit = 20) {
        const [rows] = await db.query(`
            SELECT r.*, u.full_name, u.avatar
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.destination_id = $1
            ORDER BY r.created_at DESC
            LIMIT $2
        `, [destinationId, limit]);
        return rows;
    }

    static async getAll(limit = 30, offset = 0) {
        const [rows] = await db.query(`
            SELECT r.*, u.full_name, u.avatar, d.name as destination_name, d.slug as destination_slug
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            LEFT JOIN destinations d ON r.destination_id = d.id
            ORDER BY r.created_at DESC
            LIMIT $1 OFFSET $2
        `, [limit, offset]);
        return rows;
    }

    static async create(data) {
        const id = uuidv4();
        await db.query(`
            INSERT INTO reviews (id, user_id, destination_id, content, rating, images)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [id, data.user_id, data.destination_id, data.content, data.rating, JSON.stringify(data.images || [])]);
        return id;
    }

    static async toggleLike(reviewId, userId) {
        const [existing] = await db.query(
            'SELECT id FROM review_likes WHERE review_id = $1 AND user_id = $2',
            [reviewId, userId]
        );
        if (existing.length > 0) {
            await db.query('DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2', [reviewId, userId]);
            await db.query('UPDATE reviews SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = $1', [reviewId]);
            return false; // unliked
        } else {
            await db.query('INSERT INTO review_likes (id, review_id, user_id) VALUES ($1, $2, $3)', [uuidv4(), reviewId, userId]);
            await db.query('UPDATE reviews SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = $1', [reviewId]);
            return true; // liked
        }
    }

    static async addComment(reviewId, userId, content) {
        const id = uuidv4();
        await db.query(
            'INSERT INTO review_comments (id, review_id, user_id, content) VALUES ($1, $2, $3, $4)',
            [id, reviewId, userId, content]
        );
        return id;
    }

    static async getComments(reviewId) {
        const [rows] = await db.query(`
            SELECT rc.*, u.full_name, u.avatar
            FROM review_comments rc
            JOIN users u ON rc.user_id = u.id
            WHERE rc.review_id = $1
            ORDER BY rc.created_at ASC
        `, [reviewId]);
        return rows;
    }

    static async getStats(destinationId) {
        const [rows] = await db.query(`
            SELECT COUNT(*) as total, AVG(rating) as avg_rating
            FROM reviews WHERE destination_id = $1
        `, [destinationId]);
        return rows[0];
    }
}

module.exports = Review;
