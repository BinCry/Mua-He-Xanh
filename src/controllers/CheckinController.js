const Destination = require('../models/Destination');

class CheckinController {
    async index(req, res) {
        try {
            const slug = req.query.slug || null;
            let dest = null;
            
            if (slug) {
                dest = await Destination.findBySlug(slug);
            }

            res.render('checkin/index', {
                title: 'Check-in tại điểm',
                dest: dest,
                slug: slug
            });
        } catch (error) {
            console.error("Checkin index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new CheckinController();
