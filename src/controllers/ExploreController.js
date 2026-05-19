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
                        "SELECT * FROM messages WHERE destination_id = ? AND (sender_id = ? OR receiver_id = ?) ORDER BY created_at ASC",
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

            // If empty, fallback to cover_image + default seeds for visual aesthetic wow factor
            if (galleryImages.length === 0) {
                galleryImages = [
                    dest.cover_image,
                    '/images/hero-1.png',
                    '/images/hero-2.png',
                    '/images/hero-3.png'
                ];
            }

            res.render('explore/show', {
                title: dest.name,
                dest: dest,
                related: related,
                messages: messages,
                galleryImages: galleryImages
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
