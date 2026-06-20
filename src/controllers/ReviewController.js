/**
 * Review Controller - Community Social Feed
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads')),
        filename: (req, file, cb) => cb(null, 'review_' + Date.now() + path.extname(file.originalname))
    }),
    limits: { fileSize: 5 * 1024 * 1024 }
});

const ReviewController = {

    index: async (req, res) => {
        try {
            const [reviews] = await db.query(`
                SELECT r.*, u.full_name, u.avatar, d.name as destination_name
                FROM reviews r
                JOIN users u ON r.user_id = u.id
                LEFT JOIN destinations d ON r.destination_id = d.id
                ORDER BY r.created_at DESC LIMIT 50
            `);
            res.render('reviews/index', {
                title: 'Cộng đồng Bình Lợi',
                reviews
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

            const { content, rating, lat, lng } = req.body;
            if (!content) return res.status(400).json({ success: false, message: 'Nội dung không được trống' });

            const id = uuidv4();
            let images = null;
            if (req.file) {
                const { uploadToCloudinary } = require('../config/cloudinary');
                const result = await uploadToCloudinary(req.file.path, 'binh-loi/reviews');
                images = JSON.stringify([result.url]);
            }

            // Auto-detect location name via reverse geocoding if coordinates provided
            let locationName = null;
            let locationLat = lat ? parseFloat(lat) : null;
            let locationLng = lng ? parseFloat(lng) : null;

            // Try to match with nearest destination
            let destinationId = null;
            if (locationLat && locationLng) {
                const [nearDest] = await db.query(`
                    SELECT id, name FROM destinations 
                    WHERE lat IS NOT NULL AND lng IS NOT NULL 
                    AND ABS(lat - ?) < 0.005 AND ABS(lng - ?) < 0.005
                    ORDER BY ABS(lat - ?) + ABS(lng - ?) ASC LIMIT 1
                `, [locationLat, locationLng, locationLat, locationLng]);
                if (nearDest.length > 0) {
                    destinationId = nearDest[0].id;
                    locationName = nearDest[0].name;
                }
            }

            await db.query(
                `INSERT INTO reviews (id, user_id, destination_id, content, rating, images, location_lat, location_lng, location_name, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [id, user.id, destinationId, content, rating || 5, images, locationLat, locationLng, locationName]
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
                'SELECT id FROM review_likes WHERE review_id = ? AND user_id = ?',
                [review_id, user.id]
            );

            if (existing.length > 0) {
                await db.query('DELETE FROM review_likes WHERE review_id = ? AND user_id = ?', [review_id, user.id]);
                await db.query('UPDATE reviews SET likes_count = GREATEST(0, likes_count - 1) WHERE id = ?', [review_id]);
            } else {
                await db.query('INSERT INTO review_likes (id, review_id, user_id) VALUES (?, ?, ?)', [uuidv4(), review_id, user.id]);
                await db.query('UPDATE reviews SET likes_count = likes_count + 1 WHERE id = ?', [review_id]);
            }

            const [result] = await db.query('SELECT likes_count FROM reviews WHERE id = ?', [review_id]);
            res.json({ success: true, likes: result[0]?.likes_count || 0 });
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
                'INSERT INTO review_comments (id, review_id, user_id, content) VALUES (?, ?, ?, ?)',
                [uuidv4(), review_id, user.id, comment]
            );
            await db.query('UPDATE reviews SET comments_count = comments_count + 1 WHERE id = ?', [review_id]);
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
