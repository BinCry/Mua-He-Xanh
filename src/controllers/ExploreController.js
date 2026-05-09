const Destination = require('../models/Destination');

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

            res.render('explore/show', {
                title: dest.name,
                dest: dest,
                related: related
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
