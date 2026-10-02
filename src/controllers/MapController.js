const UserSession = require('../models/UserSession');
const Journey = require('../models/Journey');
const cache = require('../core/cache');

class MapController {
    async index(req, res) {
        try {
            const Destination = require('../models/Destination');
            const mapCacheKey = 'map:destinations';
            let allDests = cache.get(mapCacheKey);
            if (!allDests) {
                allDests = await Destination.getMapData();
                cache.set(mapCacheKey, allDests, 180);
            }

            const uuid = req.cookies ? req.cookies.session_uuid : null;
            let journeyWithStops = null;
            if (uuid) {
                const session = await UserSession.findByUuid(uuid);
                if (session) {
                    const journey = await Journey.getActiveBySession(session.id);
                    if (journey) {
                        journeyWithStops = await Journey.getWithStops(journey.id);
                    }
                }
            }

            const cartoBasemapApiKey = (process.env.CARTO_BASEMAP_API_KEY || '').trim();

            res.render('map/index', {
                title: 'Bản đồ Tương tác Bình Lợi',
                allDests: allDests,
                journey: journeyWithStops,
                cartoBasemapApiKey
            });
        } catch (error) {
            console.error("Map index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }
}

module.exports = new MapController();
