/**
 * Review Controller - Pure PostgreSQL
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cache = require('../core/cache');
const HomeController = require('./HomeController');
const CommunityEngagement = require('../services/CommunityEngagement');

const REVIEWS_CACHE_KEY = 'reviews:index';
const invalidateReviewCache = () => {
    cache.del(REVIEWS_CACHE_KEY);
    HomeController.clearCache();
};
const ALLOWED_UPLOADS = new Map([
    ['image/jpeg', new Set(['.jpg', '.jpeg'])],
    ['image/png', new Set(['.png'])],
    ['image/webp', new Set(['.webp'])],
    ['image/gif', new Set(['.gif'])],
    ['video/mp4', new Set(['.mp4'])],
    ['video/webm', new Set(['.webm'])]
]);

function isAllowedUpload(file) {
    const extension = path.extname(file.originalname || '').toLowerCase();
    return ALLOWED_UPLOADS.get(file.mimetype)?.has(extension) === true;
}

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
        filename: (req, file, cb) => cb(null, 'review_' + Date.now() + '_' + Math.round(Math.random() * 1e9) + path.extname(file.originalname))
    }),
    limits: { fileSize: 15 * 1024 * 1024, files: 30 },
    fileFilter: (req, file, callback) => {
        if (!isAllowedUpload(file)) return callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
        callback(null, true);
    }
});

const ReviewController = {

    index: async (req, res) => {
        try {
            let data = cache.get(REVIEWS_CACHE_KEY);
            if (!data) {
                const [reviews] = await db.query(`
                SELECT r.id, r.user_id, r.content, r.rating, r.images, r.created_at,
                       r.likes_count, r.comments_count,
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
                data = { reviews, destinations };
                cache.set(REVIEWS_CACHE_KEY, data, 90);
            }
            res.render('reviews/index', {
                title: 'Cộng đồng Bình Lợi',
                reviews: data.reviews,
                destinations: data.destinations
            });
        } catch (error) {
            console.error('Reviews error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    create: [upload.any(), async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { rating, destination_id } = req.body;
            let content = req.body.content ? req.body.content.trim() : '';
            const parsedRating = Number(rating ?? 5);
            if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
                return res.status(400).json({ success: false, message: 'Đánh giá phải là số nguyên từ 1 đến 5.' });
            }
            if (content.length > 3000) {
                return res.status(400).json({ success: false, message: 'Nội dung bài viết tối đa 3.000 ký tự.' });
            }

            // Collect all uploaded files from req.files and/or req.file
            let uploadedFiles = [];
            if (req.files) {
                if (Array.isArray(req.files)) {
                    uploadedFiles = req.files;
                } else if (typeof req.files === 'object') {
                    Object.values(req.files).forEach(fArr => {
                        if (Array.isArray(fArr)) uploadedFiles.push(...fArr);
                        else if (fArr) uploadedFiles.push(fArr);
                    });
                }
            }
            if (req.file) {
                uploadedFiles.push(req.file);
            }

            if (!content) {
                content = uploadedFiles.length > 0 ? 'Đã check-in tại Bình Lợi ✨' : `Đánh giá ${rating || 5} sao cho điểm đến`;
            }

            const id = uuidv4();
            const savedImageUrls = [];
            const { uploadToCloudinary } = require('../config/cloudinary');

            for (const file of uploadedFiles) {
                let savedPath = null;
                try {
                    const result = await uploadToCloudinary(file.path || file.buffer, 'binh-loi/reviews');
                    if (result && (result.secure_url || result.url)) {
                        savedPath = result.secure_url || result.url;
                    }
                } catch(e) {
                    console.log('Cloudinary upload warning:', e.message);
                }

                if (!savedPath) {
                    return res.status(503).json({
                        success: false,
                        message: 'Không thể lưu ảnh an toàn lúc này. Vui lòng thử lại sau.'
                    });
                }

                savedImageUrls.push(savedPath);
            }

            const images = savedImageUrls.length > 0 ? JSON.stringify(savedImageUrls) : null;

            let locationName = null;
            let destId = destination_id || null;
            if (destId) {
                const [destRow] = await db.query('SELECT name FROM destinations WHERE id = $1 AND is_active = 1', [destId]);
                if (destRow.length > 0) {
                    locationName = destRow[0].name;
                } else {
                    return res.status(409).json({ success: false, message: 'Điểm đến này hiện không khả dụng.' });
                }
            }

            await db.query(
                `INSERT INTO reviews (id, user_id, destination_id, content, rating, images, location_name, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
                [id, user.id, destId, content, parsedRating, images, locationName]
            );
            invalidateReviewCache();

            res.json({ success: true, message: 'Đã đăng bài!' });
        } catch (error) {
            console.error('Create review error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    }],

    toggleLikeLegacy: async (req, res) => {
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
            invalidateReviewCache();
            res.json({ success: true, likes: parseInt(result[0]?.likes_count || 0, 10) });
        } catch (error) {
            console.error('Like error:', error);
            res.status(500).json({ success: false, message: 'Không thể cập nhật lượt thích lúc này.' });
        }
    },

    toggleLike: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user?.id) {
                return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thả tim.' });
            }

            const reviewId = typeof req.body?.review_id === 'string' ? req.body.review_id.trim() : '';
            if (!reviewId) {
                return res.status(400).json({ success: false, message: 'Thiếu ID bài viết.' });
            }

            const result = await db.transaction(async (tx) => {
                // Serialize every reaction to one post. This prevents double
                // clicks and concurrent requests from drifting the counter.
                const [reviews] = await tx.query(
                    'SELECT id, comments_count FROM reviews WHERE id = $1 FOR UPDATE',
                    [reviewId]
                );
                if (!reviews.length) {
                    const error = new Error('REVIEW_NOT_FOUND');
                    error.code = 'REVIEW_NOT_FOUND';
                    throw error;
                }

                const [existing] = await tx.query(
                    'SELECT id FROM review_likes WHERE review_id = $1 AND user_id = $2',
                    [reviewId, user.id]
                );
                const liked = existing.length === 0;
                if (liked) {
                    await tx.query(
                        'INSERT INTO review_likes (id, review_id, user_id, guest_uuid) VALUES ($1, $2, $3, NULL)',
                        [uuidv4(), reviewId, user.id]
                    );
                } else {
                    // Clear any historical duplicate rows, then calculate the
                    // public number from the relation that owns it.
                    await tx.query('DELETE FROM review_likes WHERE review_id = $1 AND user_id = $2', [reviewId, user.id]);
                }

                const [totals] = await tx.query(
                    'SELECT COUNT(*)::int AS likes FROM review_likes WHERE review_id = $1',
                    [reviewId]
                );
                const [updated] = await tx.query(
                    'UPDATE reviews SET likes_count = $1 WHERE id = $2 RETURNING likes_count, comments_count',
                    [Number(totals[0]?.likes || 0), reviewId]
                );
                return {
                    reviewId,
                    liked,
                    likes: Number(updated[0]?.likes_count || 0),
                    comments: Number(updated[0]?.comments_count || 0)
                };
            });

            invalidateReviewCache();
            CommunityEngagement.publish(result);
            res.json({ success: true, review_id: result.reviewId, liked: result.liked, likes: result.likes, comments: result.comments });
        } catch (error) {
            if (error.code === 'REVIEW_NOT_FOUND') {
                return res.status(404).json({ success: false, message: 'Không tìm thấy bài viết.' });
            }
            console.error('Like error:', error);
            res.status(500).json({ success: false, message: 'Không thể cập nhật lượt thích lúc này.' });
        }
    },

    engagement: async (req, res) => {
        const requested = String(req.query?.ids || '').split(',').map(id => id.trim()).filter(Boolean);
        const ids = [...new Set(requested)].slice(0, 50);
        if (!ids.length) return res.json({ success: true, data: [] });
        if (ids.some(id => !/^[a-zA-Z0-9-]{1,100}$/.test(id))) {
            return res.status(400).json({ success: false, message: 'Danh sách bài viết không hợp lệ.' });
        }
        try {
            const [reviews] = await db.query(
                'SELECT id, likes_count, comments_count FROM reviews WHERE id = ANY($1::varchar[])',
                [ids]
            );
            res.set('Cache-Control', 'no-store, private');
            res.json({
                success: true,
                data: reviews.map(review => ({
                    reviewId: review.id,
                    likes: Number(review.likes_count || 0),
                    comments: Number(review.comments_count || 0)
                }))
            });
        } catch (error) {
            console.error('Review engagement query error:', error);
            res.status(500).json({ success: false, message: 'Không thể đồng bộ tương tác.' });
        }
    },

    engagementStream: (req, res) => {
        res.status(200);
        res.set({
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, private',
            // Event streams must not be buffered by the global compression
            // middleware, otherwise other tabs receive a connection but not
            // the committed counter event until its buffer happens to fill.
            'Content-Encoding': 'identity',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no'
        });
        res.flushHeaders();
        res.write(': connected\n\n');
        if (typeof res.flush === 'function') res.flush();
        const unsubscribe = CommunityEngagement.subscribe(res);
        req.on('close', unsubscribe);
    },

    comment: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) {
                return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để gửi bình luận.' });
            }

            const userId = user.id;
            const { review_id, comment, parent_id } = req.body;
            const normalizedComment = typeof comment === 'string' ? comment.trim() : '';
            if (!review_id || !normalizedComment) {
                return res.status(400).json({ success: false, message: 'Nội dung bình luận không được để trống.' });
            }

            if (normalizedComment.length > 1000) {
                return res.status(400).json({ success: false, message: 'Bình luận tối đa 1.000 ký tự.' });
            }

            const commentId = uuidv4();
            const newCount = await db.transaction(async (tx) => {
                const [reviews] = await tx.query('SELECT id FROM reviews WHERE id = $1 FOR UPDATE', [review_id]);
                if (!reviews.length) {
                    const error = new Error('REVIEW_NOT_FOUND');
                    error.code = 'REVIEW_NOT_FOUND';
                    throw error;
                }
                if (parent_id) {
                    const [parents] = await tx.query(
                        'SELECT id FROM review_comments WHERE id = $1 AND review_id = $2 LIMIT 1',
                        [parent_id, review_id]
                    );
                    if (!parents.length) {
                        const error = new Error('PARENT_NOT_IN_REVIEW');
                        error.code = 'PARENT_NOT_IN_REVIEW';
                        throw error;
                    }
                }
                await tx.query(
                    'INSERT INTO review_comments (id, review_id, user_id, guest_uuid, parent_id, content, created_at) VALUES ($1, $2, $3, $4, $5, $6, NOW())',
                    [commentId, review_id, userId, null, parent_id || null, normalizedComment]
                );
                const [updated] = await tx.query(
                    'UPDATE reviews SET comments_count = comments_count + 1 WHERE id = $1 RETURNING comments_count, likes_count',
                    [review_id]
                );
                return {
                    comments: parseInt(updated[0]?.comments_count || 0, 10),
                    likes: parseInt(updated[0]?.likes_count || 0, 10)
                };
            });
            invalidateReviewCache();
            CommunityEngagement.publish({ reviewId: review_id, likes: newCount.likes, comments: newCount.comments });
            
            res.json({ 
                success: true, 
                count: newCount.comments,
                comment: {
                    id: commentId,
                    parent_id: parent_id || null,
                    content: normalizedComment,
                    created_at: new Date().toISOString(),
                    full_name: user.full_name,
                    avatar: user.avatar || '/images/default-avatar.svg'
                }
            });
        } catch (error) {
            if (['REVIEW_NOT_FOUND', 'PARENT_NOT_IN_REVIEW'].includes(error.code)) {
                return res.status(409).json({ success: false, message: 'Bình luận trả lời không hợp lệ.' });
            }
            console.error('Comment error:', error);
            res.status(500).json({ success: false, message: 'Không thể gửi bình luận lúc này.' });
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
                       COALESCE(u.avatar, '/images/default-avatar.svg') as avatar
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

            const newCount = await db.transaction(async (tx) => {
                // The comment count and its relation must be changed under
                // the same post lock used by comment creation.
                await tx.query('SELECT id FROM reviews WHERE id = $1 FOR UPDATE', [comment.review_id]);
                await tx.query('DELETE FROM review_comments WHERE id = $1 OR parent_id = $1', [comment_id]);
                const [countRow] = await tx.query('SELECT COUNT(*) as cnt FROM review_comments WHERE review_id = $1', [comment.review_id]);
                const count = parseInt(countRow[0]?.cnt || 0, 10);
                await tx.query('UPDATE reviews SET comments_count = $1 WHERE id = $2', [count, comment.review_id]);
                return count;
            });
            invalidateReviewCache();
            const [totals] = await db.query('SELECT likes_count FROM reviews WHERE id = $1', [comment.review_id]);
            CommunityEngagement.publish({ reviewId: comment.review_id, likes: Number(totals[0]?.likes_count || 0), comments: newCount });

            res.json({ success: true, message: 'Đã xóa bình luận!', count: newCount, review_id: comment.review_id });
        } catch (error) {
            console.error('Delete comment error:', error);
            res.status(500).json({ success: false, message: 'Không thể xóa bình luận lúc này.' });
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
            invalidateReviewCache();

            res.json({ success: true, message: 'Đã xóa bài viết thành công!' });
        } catch (error) {
            console.error('Delete review error:', error);
            res.status(500).json({ success: false, message: 'Không thể xóa bài viết lúc này.' });
        }
    },

    videoEditor: async (req, res) => {
        try {
            const user = req.user || req.session?.user || null;
            const [soundscapes] = await db.query(
                "SELECT * FROM soundscapes WHERE is_active = 1 ORDER BY created_at DESC"
            );
            const [videoTemplates] = await db.query(
                "SELECT * FROM video_templates WHERE is_published = true ORDER BY id ASC"
            );
            const [destinations] = await db.query(
                "SELECT id, name, slug, description, short_desc, cover_image, gallery, type FROM destinations WHERE is_active = 1 ORDER BY name ASC"
            );
            let userProjects = [];
            if (user) {
                const [projects] = await db.query(
                    "SELECT id, title, aspect_ratio, duration, thumbnail, updated_at FROM studio_projects WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 10",
                    [user.id]
                );
                userProjects = projects;
            }
            res.render('reviews/video-editor', {
                title: 'Bình Lợi Studio – Trình Tạo Video Ngắn',
                soundscapes,
                videoTemplates,
                destinations,
                userProjects,
                currentUser: user
            });
        } catch (error) {
            console.error('Video editor page error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    }
};

module.exports = ReviewController;
