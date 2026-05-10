/**
 * Review Controller - Chương 5.13: Review & Cộng đồng
 * Tham khảo SocialController.php từ Relioo (feed, like, comment)
 */
const Review = require('../models/Review');
const db = require('../core/database');

const ReviewController = {

    // GET /reviews — Social Feed (Bảng tin cộng đồng)
    index: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = 12;
            const offset = (page - 1) * limit;
            
            const reviews = await Review.getAll(limit, offset);

            // Check if user liked each review
            const user = req.user || req.session.user;
            if (user) {
                for (let r of reviews) {
                    const [liked] = await db.query(
                        'SELECT id FROM review_likes WHERE review_id = ? AND user_id = ?',
                        [r.id, user.id]
                    );
                    r.isLiked = liked.length > 0;
                }
            }

            // Get destinations for filter/dropdown
            const [destinations] = await db.query('SELECT id, name FROM destinations WHERE is_active = TRUE');

            res.render('reviews/index', {
                title: 'Cộng Đồng Du Khách',
                reviews,
                destinations,
                currentPage: page
            });
        } catch (error) {
            console.error('Reviews index error:', error);
            res.status(500).send('Lỗi hệ thống');
        }
    },

    // POST /api/reviews — Đăng review mới
    create: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập' });

            const { destination_id, content, rating } = req.body;
            if (!content || !destination_id) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập nội dung và chọn địa điểm' });
            }

            const id = await Review.create({
                user_id: user.id,
                destination_id,
                content,
                rating: rating || 5,
                images: []
            });

            // Award points
            await db.query('UPDATE users SET total_points = COALESCE(total_points, 0) + 20 WHERE id = ?', [user.id]);

            res.json({ success: true, message: 'Đăng bài thành công! +20 điểm 🎉', id });
        } catch (error) {
            console.error('Create review error:', error);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống' });
        }
    },

    // POST /api/reviews/like — Like/Unlike
    toggleLike: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false });

            const liked = await Review.toggleLike(req.body.review_id, user.id);
            res.json({ success: true, liked });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi' });
        }
    },

    // POST /api/reviews/comment — Bình luận
    comment: async (req, res) => {
        try {
            const user = req.user || req.session.user;
            if (!user) return res.status(401).json({ success: false });

            const { review_id, content } = req.body;
            if (!content) return res.status(400).json({ success: false, message: 'Nội dung trống' });

            await Review.addComment(review_id, user.id, content);
            res.json({ success: true, message: 'Đã bình luận!' });
        } catch (error) {
            res.status(500).json({ success: false, message: 'Lỗi' });
        }
    }
};

module.exports = ReviewController;
