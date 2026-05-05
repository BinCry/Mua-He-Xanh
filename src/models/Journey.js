const Model = require('../core/Model');
const Destination = require('./Destination');
const JourneyStop = require('./JourneyStop');

class Journey extends Model {
    constructor() {
        super('journeys');
    }

    /** Get active journey by session */
    async getActiveBySession(sessionId) {
        return this.findOne({ session_id: sessionId, status: 'active' });
    }

    /** Get journey with stops and destinations */
    async getWithStops(journeyId) {
        const journey = await this.findById(journeyId);
        if (!journey) return null;

        const [stops] = await this.db.query(
            `SELECT js.*, d.name, d.slug, d.short_desc, d.type, d.cover_image, d.lat, d.lng,
                    d.is_hub, d.points, d.map_x, d.map_y, d.radius_meter, d.qr_secret,
                    d.highlight, d.checkin_tip, d.best_time, d.story, d.zen_walk_desc,
                    d.open_hours, d.cost
             FROM journey_stops js
             JOIN destinations d ON js.destination_id = d.id
             WHERE js.journey_id = ?
             ORDER BY js.stop_order ASC`,
            [journeyId]
        );
        journey.stops = stops;

        return journey;
    }

    /** Create personalized journey */
    async createPersonalized(sessionId, mood, duration, interests = []) {
        // 1. Hub mandatory
        const hub = await Destination.getHub();
        if (!hub) throw new Error('Hub not found');

        // 2. Get candidates
        const candidates = await Destination.getForJourney(mood, interests, [hub.id]);

        // 3. Filter by season (Làng Mai)
        const month = new Date().getMonth() + 1;
        let filteredCandidates = candidates.filter(d => {
            if (d.slug === 'lang-mai-vang') return month === 12 || month === 1;
            return true;
        });

        // 4. Max stops
        const maxStops = (duration === 'full_day') ? 5 : 3;

        // 5. Greedy Nearest-Neighbor
        const selected = [hub];
        let remaining = filteredCandidates;
        for (let i = 0; i < maxStops && remaining.length > 0; i++) {
            const last = selected[selected.length - 1];
            remaining.sort((a, b) => {
                const d1 = Model.haversine(last.lat, last.lng, a.lat, a.lng);
                const d2 = Model.haversine(last.lat, last.lng, b.lat, b.lng);
                return d1 - d2;
            });
            selected.push(remaining.shift());
        }

        // 6. Metrics
        let totalMeters = 0;
        for (let i = 1; i < selected.length; i++) {
            totalMeters += Model.haversine(
                selected[i - 1].lat, selected[i - 1].lng,
                selected[i].lat, selected[i].lng
            );
        }
        const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
        const timePerStop = (duration === 'full_day') ? 60 : 45;
        const totalMinutes = selected.length * timePerStop + Math.round(totalKm * 15);

        // 7. Mark old journeys as abandoned
        await this.db.query(
            "UPDATE journeys SET status = 'abandoned' WHERE session_id = ? AND status = 'active'",
            [sessionId]
        );

        // 8. Create Journey
        const journeyId = await this.create({
            session_id: sessionId,
            mood: mood,
            duration: duration,
            interests: JSON.stringify(interests),
            total_km: totalKm,
            total_minutes: totalMinutes,
            status: 'active',
        });

        // 9. Create JourneyStops
        for (let idx = 0; idx < selected.length; idx++) {
            await JourneyStop.create({
                journey_id: journeyId,
                destination_id: selected[idx].id,
                stop_order: idx,
                is_completed: 0,
            });
        }

        return this.getWithStops(journeyId);
    }

    /** Create preset journey */
    async createPreset(sessionId, theme) {
        let slugs = [];
        switch (theme) {
            case 'an-nhien':
                slugs = ['chua-thanh-tam', 'vuon-dua-binh-loi', 'cong-vien-van-hoa-lang-le'];
                break;
            case 'lang-nghe':
                slugs = ['lang-nghe-nhang', 'lang-mai-vang', 'chua-phap-tang'];
                break;
            case 'hoi-xuan':
                slugs = ['lang-mai-vang', 'cong-vien-van-hoa-lang-le', 'chua-thanh-tam'];
                break;
            default:
                throw new Error("Theme invalid");
        }

        const selected = [];
        for (const slug of slugs) {
            const d = await Destination.findBySlug(slug);
            if (d) selected.push(d);
        }

        await this.db.query(
            "UPDATE journeys SET status = 'replaced' WHERE session_id = ? AND status = 'active'",
            [sessionId]
        );

        const journeyId = await this.create({
            session_id: sessionId,
            mood: theme,
            duration: 'full_day',
            interests: JSON.stringify({ preset: theme }),
            total_km: 4.5,
            total_minutes: 180,
            status: 'active',
        });

        for (let idx = 0; idx < selected.length; idx++) {
            await JourneyStop.create({
                journey_id: journeyId,
                destination_id: selected[idx].id,
                stop_order: idx,
                is_completed: 0,
            });
        }

        return this.getWithStops(journeyId);
    }
}

module.exports = new Journey();
