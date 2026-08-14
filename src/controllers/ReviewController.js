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
                try {
                    const { uploadToCloudinary } = require('../config/cloudinary');
                    const result = await uploadToCloudinary(req.file.path || req.file.buffer, 'binh-loi/reviews');
                    if (result && (result.secure_url || result.url)) {
                        savedPath = result.secure_url || result.url;
                    }
                } catch(e) {
                    console.log('Cloudinary upload warning:', e.message);
                }

                if (!savedPath && req.file.path && fs.existsSync(req.file.path)) {
                    try {
                        const fileBuf = fs.readFileSync(req.file.path);
                        const mime = req.file.mimetype || 'image/jpeg';
                        savedPath = `data:${mime};base64,${fileBuf.toString('base64')}`;
                    } catch(readErr) {
                        console.error('Base64 fallback error:', readErr);
                    }
                }

                if (!savedPath && req.file.filename) {
                    savedPath = '/uploads/' + req.file.filename;
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
                SELECT c.id, c.review_id, c.parent_id, c.content, c.created_at, c.user_id, c.guest_uuid,
                       r.user_id as post_user_id,
                       COALESCE(u.full_name, 'Du khách Bình Lợi') as full_name,
                       COALESCE(u.avatar, '/images/default-avatar.png') as avatar
                FROM review_comments c
                JOIN reviews r ON c.review_id = r.id
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

    deleteComment: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            const sessionUuid = req.cookies?.session_uuid;

            const { comment_id } = req.body;
            if (!comment_id) return res.status(400).json({ success: false, message: 'Thiếu ID bình luận' });

            const [rows] = await db.query(
                `SELECT c.id, c.review_id, c.user_id as comment_user_id, c.guest_uuid as comment_guest_uuid, r.user_id as post_user_id
                 FROM review_comments c
                 JOIN reviews r ON c.review_id = r.id
                 WHERE c.id = $1`,
                [comment_id]
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy bình luận' });
            }

            const comment = rows[0];
            const isCommentAuthor = (user && String(comment.comment_user_id) === String(user.id)) || (sessionUuid && comment.comment_guest_uuid === sessionUuid);
            const isPostAuthor = user && String(comment.post_user_id) === String(user.id);
            const isAdmin = user && (user.role === 'admin' || user.role === 'manager');

            if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bình luận này.' });
            }

            await db.query('DELETE FROM review_comments WHERE id = $1 OR parent_id = $1', [comment_id]);

            const [countRow] = await db.query('SELECT COUNT(*) as cnt FROM review_comments WHERE review_id = $1', [comment.review_id]);
            const newCount = parseInt(countRow[0]?.cnt || 0, 10);
            await db.query('UPDATE reviews SET comments_count = $1 WHERE id = $2', [newCount, comment.review_id]);

            res.json({ success: true, message: 'Đã xóa bình luận!', count: newCount, review_id: comment.review_id });
        } catch (error) {
            console.error('Delete comment error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
        }
    },

    delete: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { review_id } = req.body;
            if (!review_id) return res.status(400).json({ success: false, message: 'Thiếu ID bài viết' });

            const [rows] = await db.query('SELECT id, user_id FROM reviews WHERE id = $1', [review_id]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết' });

            if (String(rows[0].user_id) !== String(user.id) && user.role !== 'admin') {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa bài viết này' });
            }

            await db.query('DELETE FROM review_comments WHERE review_id = $1', [review_id]);
            await db.query('DELETE FROM review_likes WHERE review_id = $1', [review_id]);
            await db.query('DELETE FROM reviews WHERE id = $1', [review_id]);

            res.json({ success: true, message: 'Đã xóa bài viết thành công!' });
        } catch (error) {
            console.error('Delete review error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống: ' + error.message });
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
