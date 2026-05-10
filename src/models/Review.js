const db = require('../core/database');

class Review {
    static async getByDestination(destinationId, limit = 20) {
        const [rows] = await db.query(`
            SELECT r.*, u.full_name, u.avatar
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.destination_id = ?
            ORDER BY r.created_at DESC
            LIMIT ?
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
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        return rows;
    }

    static async create(data) {
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        await db.query(`
            INSERT INTO reviews (id, user_id, destination_id, content, rating, images)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [id, data.user_id, data.destination_id, data.content, data.rating, JSON.stringify(data.images || [])]);
        return id;
    }

    static async toggleLike(reviewId, userId) {
        const { v4: uuidv4 } = require('uuid');
        const [existing] = await db.query(
            'SELECT id FROM review_likes WHERE review_id = ? AND user_id = ?',
            [reviewId, userId]
        );
        if (existing.length > 0) {
            await db.query('DELETE FROM review_likes WHERE review_id = ? AND user_id = ?', [reviewId, userId]);
            await db.query('UPDATE reviews SET likes_count = likes_count - 1 WHERE id = ?', [reviewId]);
            return false; // unliked
        } else {
            await db.query('INSERT INTO review_likes (id, review_id, user_id) VALUES (?, ?, ?)', [uuidv4(), reviewId, userId]);
            await db.query('UPDATE reviews SET likes_count = likes_count + 1 WHERE id = ?', [reviewId]);
            return true; // liked
        }
    }

    static async addComment(reviewId, userId, content) {
        const { v4: uuidv4 } = require('uuid');
        const id = uuidv4();
        await db.query(
            'INSERT INTO review_comments (id, review_id, user_id, content) VALUES (?, ?, ?, ?)',
            [id, reviewId, userId, content]
        );
        return id;
    }

    static async getComments(reviewId) {
        const [rows] = await db.query(`
            SELECT rc.*, u.full_name, u.avatar
            FROM review_comments rc
            JOIN users u ON rc.user_id = u.id
            WHERE rc.review_id = ?
            ORDER BY rc.created_at ASC
        `, [reviewId]);
        return rows;
    }

    static async getStats(destinationId) {
        const [rows] = await db.query(`
            SELECT COUNT(*) as total, AVG(rating) as avg_rating
            FROM reviews WHERE destination_id = ?
        `, [destinationId]);
        return rows[0];
    }
}

module.exports = Review;
