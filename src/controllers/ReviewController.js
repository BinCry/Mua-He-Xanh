/**
 * Review Controller - Pure PostgreSQL
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
            const uploadPath = isProduction ? '/tmp' : path.join(__dirname, '../../public/uploads');
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            cb(null, uploadPath);
        },
        filename: (req, file, cb) => cb(null, 'review_' + Date.now() + path.extname(file.originalname))
    }),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const ReviewController = {

    index: async (req, res) => {
        try {
            const [reviews] = await db.query(`
                SELECT r.id, r.content, r.rating, r.images, r.created_at, r.likes_count,
                       u.full_name, u.avatar,
                       d.name as destination_name
                FROM (
                    SELECT id
                    FROM reviews
                    ORDER BY created_at DESC
                    LIMIT 50
                ) sub
                JOIN reviews r ON sub.id = r.id
                JOIN users u ON r.user_id = u.id
                LEFT JOIN destinations d ON r.destination_id = d.id
                ORDER BY r.created_at DESC
            `);
            const [destinations] = await db.query("SELECT id, name FROM destinations WHERE is_active = 1 ORDER BY name ASC");
            res.render('reviews/index', {
                title: 'Cộng đồng Bình Lợi',
                reviews,
                destinations
            });
        } catch (error) {
            console.error('Reviews error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    create: [upload.single('image'), async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { content, rating, destination_id } = req.body;
            if (!content) return res.status(400).json({ success: false, message: 'Nội dung không được trống' });

            const id = uuidv4();
            let images = null;
            if (req.file) {
                const { uploadToCloudinary } = require('../config/cloudinary');
                const result = await uploadToCloudinary(req.file.path, 'binh-loi/reviews');
                images = JSON.stringify([result.url]);
            }

            let locationName = null;
            let destId = destination_id || null;
            if (destId) {
                const [destRow] = await db.query('SELECT name FROM destinations WHERE id = $1', [destId]);
                if (destRow.length > 0) {
                    locationName = destRow[0].name;
                }
            }

            await db.query(
                `INSERT INTO reviews (id, user_id, destination_id, content, rating, images, location_name, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [id, user.id, destId, content, parseInt(rating || '5', 10), images, locationName]
            );

            res.json({ success: true, message: 'Đã đăng bài!' });
        } catch (error) {
            console.error('Create review error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    }],

    toggleLike: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) return res.status(401).json({ success: false });

            const { review_id } = req.body;
            const [existing] = await db.query(
                'SELECT id FROM review_likes WHERE review_id = $1 AND user_id = $2',
                [review_id, user.id]
            );

            if (existing.length > 0) {
                await db.query('DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2', [review_id, user.id]);
                await db.query('UPDATE reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [review_id]);
            } else {
                await db.query('INSERT INTO review_likes (id, review_id, user_id) VALUES ($1, $2, $3)', [uuidv4(), review_id, user.id]);
                await db.query('UPDATE reviews SET likes_count = likes_count + 1 WHERE id = $1', [review_id]);
            }

            const [result] = await db.query('SELECT likes_count FROM reviews WHERE id = $1', [review_id]);
            res.json({ success: true, likes: parseInt(result[0]?.likes_count || 0, 10) });
        } catch (error) {
            console.error('Like error:', error);
            res.status(500).json({ success: false });
        }
    },

    comment: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) return res.status(401).json({ success: false });

            const { review_id, comment } = req.body;
            await db.query(
                'INSERT INTO review_comments (id, review_id, user_id, content) VALUES ($1, $2, $3, $4)',
                [uuidv4(), review_id, user.id, comment]
            );
            await db.query('UPDATE reviews SET comments_count = comments_count + 1 WHERE id = $1', [review_id]);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ success: false });
        }
    },

    videoEditor: async (req, res) => {
        try {
            const [soundscapes] = await db.query(
                "SELECT * FROM soundscapes WHERE is_active = 1 ORDER BY created_at DESC"
            );
            res.render('reviews/video-editor', {
                title: 'Tạo Video Hành Trình Cảm Giác',
                soundscapes
            });
        } catch (error) {
            console.error('Video editor page error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    }
};

module.exports = ReviewController;
