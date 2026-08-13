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

            let messages = [];
            const sessionUuid = req.cookies?.session_uuid;
            if (sessionUuid) {
                const session = await UserSession.findByUuid(sessionUuid);
                if (session) {
                    const [rawMsgs] = await UserSession.db.query(
                        "SELECT id, sender_id, sender_uuid, receiver_uuid, destination_id, COALESCE(message, content, '') as message, is_ai, created_at FROM messages WHERE destination_id = $1 AND (sender_uuid = $2 OR receiver_uuid = $3) ORDER BY created_at ASC",
                        [dest.id, session.id, session.id]
                    );
                    const user = req.user || req.session?.user || null;
                    messages = rawMsgs.map(m => {
                        const isMine = (m.sender_uuid === session.id) || (user && String(m.sender_id) === String(user.id));
                        return {
                            ...m,
                            is_mine: !!isMine
                        };
                    });
                }
            }

            // Fetch community reviews & tourist check-in photos for this destination
            const [communityReviews] = await Destination.db.query(
                `SELECT images FROM reviews 
                 WHERE (destination_id = $1 OR location_name ILIKE $2) 
                   AND images IS NOT NULL 
                 ORDER BY created_at DESC`,
                [dest.id, `%${dest.name}%`]
            );
            
            let galleryImages = [];
            communityReviews.forEach(r => {
                if (!r.images) return;
                try {
                    let parsed = r.images;
                    if (typeof parsed === 'string') {
                        if (parsed.trim().startsWith('[')) {
                            parsed = JSON.parse(parsed);
                        } else {
                            parsed = [parsed];
                        }
                    }
                    if (Array.isArray(parsed)) {
                        parsed.forEach(img => {
                            if (img && typeof img === 'string' && img.trim()) {
                                galleryImages.push(img.trim());
                            }
                        });
                    }
                } catch(e) {}
            });

            // Fallback to dest.gallery if no tourist photos exist yet
            if (galleryImages.length === 0 && dest.gallery) {
                try {
                    const parsedG = typeof dest.gallery === 'string' ? JSON.parse(dest.gallery) : dest.gallery;
                    if (Array.isArray(parsedG)) {
                        galleryImages = parsedG;
                    }
                } catch(e) {}
            }

            const user = req.user || req.session?.user || null;
            let hasLiked = false;
            let hasSaved = false;
            if (user) {
                const [likeRows] = await Destination.db.query(
                    "SELECT id FROM destination_likes WHERE user_id = $1 AND destination_id = $2",
                    [user.id, dest.id]
                );
                hasLiked = likeRows.length > 0;

                const [favRows] = await Destination.db.query(
                    "SELECT id FROM user_favorites WHERE user_id = $1 AND destination_id = $2",
                    [user.id, dest.id]
                );
                hasSaved = favRows.length > 0;
            }

            const [likesCountRows] = await Destination.db.query(
                "SELECT COUNT(*) as count FROM destination_likes WHERE destination_id = $1",
                [dest.id]
            );
            const totalLikes = parseInt(likesCountRows[0]?.count || 0, 10);

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
