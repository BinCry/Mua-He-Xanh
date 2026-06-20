const Destination = require('../models/Destination');
const UserSession = require('../models/UserSession');
const Message = require('../models/Message');

class ExploreController {
    /** List all destinations */
    async list(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const type = req.query.type || null;
            const season = req.query.season || null;
            const search = req.query.q || null;
            
            const result = await Destination.paginateActive(page, 6, type, null, search, season);
            
            res.render('explore/list', {
                title: 'Khám phá Bình Lợi',
                destinations: result.data,
                pagination: result.pagination,
                currentType: type,
                currentSeason: season,
                searchQuery: search
            });
        } catch (error) {
            console.error("Explore list error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    /** Show destination detail */
    async show(req, res) {
        try {
            const { slug } = req.params;
            const dest = await Destination.findBySlug(slug);
            
            if (!dest) {
                return res.status(404).render('errors/404', { title: 'Không tìm thấy địa điểm' });
            }

            const related = await Destination.getRelated(dest.type, dest.id);

            // Get chat history for current session
            let messages = [];
            const sessionUuid = req.cookies.session_uuid;
            if (sessionUuid) {
                const session = await UserSession.findByUuid(sessionUuid);
                if (session) {
                    [messages] = await UserSession.db.query(
                        "SELECT * FROM messages WHERE destination_id = ? AND (sender_uuid = ? OR receiver_uuid = ?) ORDER BY created_at ASC",
                        [dest.id, session.id, session.id]
                    );
                }
            }

            // Fetch real community check-in photos for this destination's artistic gallery
            const [communityReviews] = await Destination.db.query(
                "SELECT images FROM reviews WHERE destination_id = ? AND images IS NOT NULL",
                [dest.id]
            );
            
            let galleryImages = [];
            communityReviews.forEach(r => {
                try {
                    const parsed = JSON.parse(r.images);
                    if (Array.isArray(parsed)) {
                        galleryImages = galleryImages.concat(parsed);
                    }
                } catch(e) {}
            });

            // If empty, keep it empty to let the UI show a custom placeholder
            if (galleryImages.length === 0) {
                galleryImages = [];
            }

            // Check if logged-in user has liked or favorited
            const user = req.user || req.session?.user || null;
            let hasLiked = false;
            let hasSaved = false;
            if (user) {
                const [likeRows] = await Destination.db.query(
                    "SELECT id FROM destination_likes WHERE user_id = ? AND destination_id = ?",
                    [user.id, dest.id]
                );
                hasLiked = likeRows.length > 0;

                const [favRows] = await Destination.db.query(
                    "SELECT id FROM user_favorites WHERE user_id = ? AND destination_id = ?",
                    [user.id, dest.id]
                );
                hasSaved = favRows.length > 0;
            }

            // Get total likes count
            const [likesCountRows] = await Destination.db.query(
                "SELECT COUNT(*) as count FROM destination_likes WHERE destination_id = ?",
                [dest.id]
            );
            const totalLikes = likesCountRows[0]?.count || 0;

            res.render('explore/show', {
                title: dest.name,
                dest: dest,
                related: related,
                messages: messages,
                galleryImages: galleryImages,
                hasLiked: hasLiked,
                hasSaved: hasSaved,
                totalLikes: totalLikes
            });
        } catch (error) {
            console.error("Explore show error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    /** Show audio storytelling player */
    async audio(req, res) {
        try {
            const { slug } = req.params;
            const dest = await Destination.findBySlug(slug);
            
            if (!dest) {
                return res.status(404).render('errors/404', { title: 'Không tìm thấy địa điểm' });
            }

            res.render('explore/audio', {
                title: 'Audio Storytelling: ' + dest.name,
                dest: dest
            });
        } catch (error) {
            console.error("Explore audio error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new ExploreController();
