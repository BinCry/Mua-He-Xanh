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
                SELECT r.id, r.content, r.rating, r.images, r.created_at,
                       (SELECT COUNT(*) FROM review_likes WHERE review_id = r.id) as likes_count,
                       (SELECT COUNT(*) FROM review_comments WHERE review_id = r.id) as comments_count,
                       u.full_name, u.avatar,
                       d.name as destination_name, r.location_name
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

            const { rating, destination_id } = req.body;
            let content = req.body.content ? req.body.content.trim() : '';
            if (!content) {
                content = req.file ? 'Đã check-in tại Bình Lợi ✨' : `Đánh giá ${rating || 5} sao cho điểm đến`;
            }

            const id = uuidv4();
            let images = null;
            if (req.file) {
                let savedPath = null;
                if (req.file.filename) {
                    savedPath = '/uploads/' + req.file.filename;
                } else if (req.file.path) {
                    const rel = req.file.path.replace(/\\/g, '/');
                    const match = rel.match(/\/uploads\/.+/i);
                    savedPath = match ? match[0] : ('/' + rel);
                }

                try {
                    const { uploadToCloudinary } = require('../config/cloudinary');
                    const result = await uploadToCloudinary(req.file.path || req.file.buffer, 'binh-loi/reviews');
                    if (result && (result.secure_url || result.url)) {
                        savedPath = result.secure_url || result.url;
                    }
                } catch(e) {
                    console.log('Cloudinary fallback to local upload path:', savedPath);
                }

                if (savedPath) {
                    images = JSON.stringify([savedPath]);
                }
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
            const sessionUuid = req.cookies?.session_uuid;
            
            // Allow logged-in users or guest session UUIDs to like posts
            const userId = user?.id || null;
            const guestUuid = !userId ? sessionUuid : null;

            if (!userId && !guestUuid) {
                return res.status(401).json({ success: false, message: 'Vui lòng mở trình duyệt bình thường để thả tim.' });
            }

            const { review_id } = req.body;
            let existing = [];
            if (userId) {
                const [rows] = await db.query(
                    'SELECT id FROM review_likes WHERE review_id = $1 AND user_id = $2',
                    [review_id, userId]
                );
                existing = rows;
            } else {
                const [rows] = await db.query(
                    'SELECT id FROM review_likes WHERE review_id = $1 AND guest_uuid = $2',
                    [review_id, guestUuid]
                );
                existing = rows;
            }

            if (existing.length > 0) {
                if (userId) {
                    await db.query('DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2', [review_id, userId]);
                } else {
                    await db.query('DELETE FROM review_likes WHERE review_id = $1 AND guest_uuid = $2', [review_id, guestUuid]);
                }
                await db.query('UPDATE reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [review_id]);
            } else {
                await db.query(
                    'INSERT INTO review_likes (id, review_id, user_id, guest_uuid) VALUES ($1, $2, $3, $4)',
                    [uuidv4(), review_id, userId, guestUuid]
                );
                await db.query('UPDATE reviews SET likes_count = likes_count + 1 WHERE id = $1', [review_id]);
            }

            const [result] = await db.query('SELECT likes_count FROM reviews WHERE id = $1', [review_id]);
            res.json({ success: true, likes: parseInt(result[0]?.likes_count || 0, 10) });
        } catch (error) {
            console.error('Like error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    comment: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            const sessionUuid = req.cookies?.session_uuid;

            const userId = user?.id || null;
            const guestUuid = !userId ? sessionUuid : null;

            const { review_id, comment, parent_id } = req.body;
            if (!comment || !comment.trim()) {
                return res.status(400).json({ success: false, message: 'Nội dung bình luận không được để trống.' });
            }

            const commentId = uuidv4();
            await db.query(
                'INSERT INTO review_comments (id, review_id, user_id, guest_uuid, parent_id, content, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
                [commentId, review_id, userId, guestUuid, parent_id || null, comment.trim()]
            );
            await db.query('UPDATE reviews SET comments_count = comments_count + 1 WHERE id = $1', [review_id]);

            const [revResult] = await db.query('SELECT comments_count FROM reviews WHERE id = $1', [review_id]);
            
            res.json({ 
                success: true, 
                count: parseInt(revResult[0]?.comments_count || 0, 10),
                comment: {
                    id: commentId,
                    parent_id: parent_id || null,
                    content: comment.trim(),
                    created_at: new Date().toISOString(),
                    full_name: user ? user.full_name : 'Du khách Bình Lợi',
                    avatar: user ? (user.avatar || '/images/default-avatar.png') : '/images/default-avatar.png'
                }
            });
        } catch (error) {
            console.error('Comment error:', error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    getComments: async (req, res) => {
        try {
            const { review_id } = req.query;
            if (!review_id) return res.json({ success: true, data: [] });

            const [comments] = await db.query(`
                SELECT c.id, c.review_id, c.parent_id, c.content, c.created_at,
                       COALESCE(u.full_name, 'Du khách Bình Lợi') as full_name,
                       COALESCE(u.avatar, '/images/default-avatar.png') as avatar
                FROM review_comments c
                LEFT JOIN users u ON c.user_id = u.id
                WHERE c.review_id = $1
                ORDER BY c.created_at ASC
            `, [review_id]);

            res.json({ success: true, data: comments });
        } catch (e) {
            console.error("getComments error:", e);
            res.json({ success: false, data: [] });
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
