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
                    d.points, d.radius_meter, d.highlight, d.story, d.open_hours
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
        const hub = await Destination.getHub();
        if (!hub) throw new Error('Hub not found');

        const candidates = await Destination.getForJourney(mood, interests, [hub.id]);

        const now = new Date();
        const month = now.getMonth() + 1;
        const hour = now.getHours();
        
        let filteredCandidates = candidates.filter(d => {
            if (d.slug === 'lang-mai-vang' && !(month === 12 || month === 1 || month === 2)) return false;
            return true;
        });

        let maxStops = (duration === 'full_day') ? 5 : 3;
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

        let totalMeters = 0;
        for (let i = 1; i < selected.length; i++) {
            totalMeters += Model.haversine(
                selected[i - 1].lat, selected[i - 1].lng,
                selected[i].lat, selected[i].lng
            );
        }
        const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
        const totalMinutes = selected.length * 60 + Math.round(totalKm * 15);

        await this.db.query(
            "UPDATE journeys SET status = 'abandoned' WHERE session_id = ? AND status = 'active'",
            [sessionId]
        );

        const journeyId = await this.create({
            session_id: sessionId,
            mood: mood,
            duration: duration,
            interests: JSON.stringify(interests),
            total_km: totalKm,
            total_minutes: totalMinutes,
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

    async createPreset(sessionId, theme) {
        let slugs = [];
        let moodName = "Hành trình";
        switch (theme) {
            case 'du-xuan': slugs = ['lang-mai-vang', 'xuong-nhang-minh', 'chua-thanh-tam']; moodName = "Du xuân Bình Lợi"; break;
            case 'miet-vuon': slugs = ['vuon-dua', 'xuong-nhang-minh', 'cong-vien-lang-le']; moodName = "Miệt vườn giữa phố"; break;
            case 'song-cham': slugs = ['rung-phong-ho', 'vuon-lan', 'cau-chu-z']; moodName = "Sống chậm Bình Lợi"; break;
            default: slugs = ['chua-phap-tang', 'chua-thanh-tam', 'cong-vien-lang-le']; moodName = "Tâm linh & Nguồn cội";
        }

        const selected = [];
        for (const slug of slugs) {
            const d = await Destination.findBySlug(slug);
            if (d) selected.push(d);
        }

        await this.db.query("UPDATE journeys SET status = 'replaced' WHERE session_id = ? AND status = 'active'", [sessionId]);

        const journeyId = await this.create({
            session_id: sessionId, mood: moodName, duration: 'full_day', status: 'active',
            total_km: 4.5, total_minutes: 180, interests: JSON.stringify({ preset: theme })
        });

        for (let idx = 0; idx < selected.length; idx++) {
            await JourneyStop.create({ journey_id: journeyId, destination_id: selected[idx].id, stop_order: idx, is_completed: 0 });
        }
        return this.getWithStops(journeyId);
    }

    async recalculateMetrics(journeyId) {
        const journey = await this.getWithStops(journeyId);
        if (!journey || !journey.stops) return;
        let totalMeters = 0;
        const stops = journey.stops;
        for (let i = 1; i < stops.length; i++) {
            totalMeters += Model.haversine(stops[i - 1].lat, stops[i - 1].lng, stops[i].lat, stops[i].lng);
        }
        const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
        await this.update(journeyId, { total_km: totalKm, total_minutes: stops.length * 60 + Math.round(totalKm * 15) });
    }

    async getRandomStops(mood, count) {
        let results = [];
        const moodFilter = (mood === 'all') ? '1=1' : "moods LIKE ?";
        const params = (mood === 'all') ? [count] : [`%${mood}%`, count];
        
        [results] = await this.db.query(`SELECT * FROM destinations WHERE is_active = 1 AND ${moodFilter} ORDER BY RAND() LIMIT ?`, params);
        if (results.length === 0) {
            [results] = await this.db.query("SELECT * FROM destinations WHERE is_active = 1 LIMIT ?", [count]);
        }
        return results;
    }

    async createFromSuggestion(sessionId, data) {
        await this.db.query("UPDATE journeys SET status = 'replaced' WHERE session_id = ? AND status = 'active'", [sessionId]);
        const journeyId = await this.create({
            session_id: sessionId, mood: data.name, duration: data.duration,
            total_km: data.km, total_minutes: 180, status: 'active', interests: JSON.stringify(data.tags)
        });
        for (let idx = 0; idx < data.stops.length; idx++) {
            await JourneyStop.create({ journey_id: journeyId, destination_id: data.stops[idx].id, stop_order: idx, is_completed: 0 });
        }
        return journeyId;
    }

    async removeStop(journeyId, destinationId) {
        await this.db.query("DELETE FROM journey_stops WHERE journey_id = ? AND destination_id = ?", [journeyId, destinationId]);
        const journey = await this.getWithStops(journeyId);
        if (journey && journey.stops) {
            for (let i = 0; i < journey.stops.length; i++) {
                await this.db.query("UPDATE journey_stops SET stop_order = ? WHERE id = ?", [i, journey.stops[i].id]);
            }
        }
    }
}

module.exports = new Journey();
