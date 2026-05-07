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

        // 3. Smart Filtering: Season + Time of Day
        const now = new Date();
        const month = now.getMonth() + 1;
        const hour = now.getHours();
        
        let filteredCandidates = candidates.filter(d => {
            // Seasonal: Mai Vàng only in Spring
            if (d.slug === 'lang-mai-vang' && !(month === 12 || month === 1 || month === 2)) return false;
            
            // Time of day: If late (after 3 PM), prefer temples/nature over crafts
            if (hour >= 15) {
                if (d.type === 'craft' && !interests.includes('craft')) return false;
            }
            
            return true;
        });

        // 4. Max stops based on duration and remaining time
        let maxStops = (duration === 'full_day') ? 5 : 3;
        if (hour >= 16) maxStops = 2; // Late start, fewer stops

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
        let moodName = "Hành trình";
        let totalKm = 4.5;
        let totalMin = 180;

        switch (theme) {
            case 'du-xuan':
            case 'hoi-xuan':
                slugs = ['lang-mai-vang', 'xuong-nhang-minh', 'chua-thanh-tam'];
                moodName = "Du xuân Bình Lợi";
                totalKm = 4.8;
                totalMin = 180;
                break;
            case 'miet-vuon':
            case 'nguoi-mien-tay':
                slugs = ['vuon-dua', 'xuong-nhang-minh', 'cong-vien-lang-le'];
                moodName = "Miệt vườn giữa phố";
                totalKm = 4.2;
                totalMin = 240;
                break;
            case 'tam-linh':
            case 'tri-an-lich-su':
                slugs = ['chua-phap-tang', 'chua-thanh-tam', 'cong-vien-lang-le'];
                moodName = "Tâm linh & Nguồn cội";
                totalKm = 3.5;
                totalMin = 150;
                break;
            case 'song-cham':
            case 'an-nhien':
                slugs = ['rung-phong-ho', 'vuon-lan', 'cau-chu-z'];
                moodName = "Sống chậm Bình Lợi";
                totalKm = 5.5;
                totalMin = 180;
                break;
            case 'lang-nghe':
                slugs = ['xuong-nhang-minh', 'lang-mai-vang', 'chua-phap-tang'];
                moodName = "Khám phá Làng nghề";
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
            mood: moodName,
            duration: 'full_day',
            interests: JSON.stringify({ preset: theme }),
            total_km: totalKm,
            total_minutes: totalMin,
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

    /** Recalculate KM and Minutes based on current stops */
    async recalculateMetrics(journeyId) {
        const journey = await this.getWithStops(journeyId);
        if (!journey || !journey.stops || journey.stops.length === 0) return;

        let totalMeters = 0;
        const stops = journey.stops;
        for (let i = 1; i < stops.length; i++) {
            totalMeters += Model.haversine(
                stops[i - 1].lat, stops[i - 1].lng,
                stops[i].lat, stops[i].lng
            );
        }
        const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
        const timePerStop = (journey.duration === 'full_day') ? 60 : 45;
        const totalMinutes = stops.length * timePerStop + Math.round(totalKm * 15);

        await this.update(journeyId, {
            total_km: totalKm,
            total_minutes: totalMinutes
        });
    }

    /** Get random stops for suggestion based on mood */
    async getRandomStops(mood, count) {
        let results = [];
        if (mood === 'all') {
            [results] = await this.db.query("SELECT * FROM destinations WHERE active = 1 ORDER BY RAND() LIMIT ?", [count]);
        } else {
            [results] = await this.db.query(
                "SELECT * FROM destinations WHERE active = 1 AND (mood_fit LIKE ? OR type = ?) ORDER BY RAND() LIMIT ?",
                [`%${mood}%`, mood, count]
            );
        }
        
        // Ensure at least some results
        if (results.length === 0) {
            [results] = await this.db.query("SELECT * FROM destinations WHERE active = 1 LIMIT ?", [count]);
        }
        return results;
    }

    /** Create a journey from a suggestion data */
    async createFromSuggestion(sessionId, data) {
        // Mark old active journeys as replaced
        await this.db.query(
            "UPDATE journeys SET status = 'replaced' WHERE session_id = ? AND status = 'active'",
            [sessionId]
        );

        // Create the new journey record
        const journeyId = await this.create({
            session_id: sessionId,
            mood: data.name, // Use the suggestion name as the mood title
            duration: data.duration,
            total_km: data.km,
            total_minutes: parseInt(data.duration.replace(/\D/g, '')) * 60 || 180,
            status: 'active',
            interests: JSON.stringify(data.tags)
        });

        // Add stops
        for (let idx = 0; idx < data.stops.length; idx++) {
            await JourneyStop.create({
                journey_id: journeyId,
                destination_id: data.stops[idx].id,
                stop_order: idx,
                is_completed: 0
            });
        }

        return journeyId;
    }

    /** Remove a stop from journey */
    async removeStop(journeyId, destinationId) {
        await this.db.query(
            "DELETE FROM journey_stops WHERE journey_id = ? AND destination_id = ?",
            [journeyId, destinationId]
        );
        // After deletion, we might need to fix the stop_order
        const journey = await this.getWithStops(journeyId);
        if (journey && journey.stops) {
            for (let i = 0; i < journey.stops.length; i++) {
                await this.db.query(
                    "UPDATE journey_stops SET stop_order = ? WHERE id = ?",
                    [i, journey.stops[i].id]
                );
            }
        }
    }
}

module.exports = new Journey();
