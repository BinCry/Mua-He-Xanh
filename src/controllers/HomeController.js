const Destination = require('../models/Destination');
const CheckIn = require('../models/CheckIn');

class HomeController {
    async index(req, res) {
        try {
            // Determine current season
            const month = new Date().getMonth() + 1;
            let season = 'summer';
            let seasonName = 'Miệt vườn giữa Phố';

            if (month >= 11 || month <= 3) {
                season = 'winter_spring';
                seasonName = 'Du xuân Bình Lợi';
            } else if (month >= 7 && month <= 10) {
                season = 'autumn_winter';
                seasonName = 'Lễ hội mùa Thu';
            }

            // Get featured destinations
            const seasonalDestinations = await Destination.getBySeason(season);
            let featured = (seasonalDestinations.length < 3) ? 
                           await Destination.getActive(6) : 
                           seasonalDestinations;

            // Community stats
            const totalCheckins = await CheckIn.getTotalCount();
            const activeDestinations = (await Destination.getActive(100)).length;

            res.render('home/index', {
                title: 'Bình Lợi – Miền Tây giữa lòng Sài Gòn',
                featured: featured,
                currentSeason: season,
                seasonName: seasonName,
                stats: {
                    checkins: totalCheckins + 1250,
                    destinations: activeDestinations,
                    reviews: 840
                }
            });
        } catch (error) {
            console.error("Home index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new HomeController();
