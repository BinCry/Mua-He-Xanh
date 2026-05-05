const UserSession = require('../models/UserSession');
const Destination = require('../models/Destination');
const Journey = require('../models/Journey');
const CheckIn = require('../models/CheckIn');
const UserBadge = require('../models/UserBadge');
const Model = require('../core/Model');
const { v4: uuidv4 } = require('uuid');

class ApiController {
    
    // --- SESSION API ---
    async session(req, res) {
        const { uuid } = req.params;
        
        if (req.method === 'POST') {
            const body = req.body;
            let currentUuid = req.cookies.session_uuid || uuid;
            
            if (!currentUuid) {
                currentUuid = uuidv4();
                res.cookie('session_uuid', currentUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
            }
            
            const data = {
                mood: body.mood || null,
                duration: body.duration || null,
                interests: body.interests ? JSON.stringify(body.interests) : null
            };
            
            const session = await UserSession.findOrCreate(currentUuid, req);
            await UserSession.update(session.id, data);
            
            res.json({ success: true, data: { ...session, ...data } });
        } else {
            if (!uuid) return res.status(400).json({ success: false, message: 'Missing UUID' });
            
            const session = await UserSession.findByUuid(uuid);
            if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
            
            // Get badges
            session.badges = await UserBadge.getUnlockedBySession(session.id);
            
            res.json({ success: true, data: session });
        }
    }

    // --- DESTINATIONS API ---
    async destinations(req, res) {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 6;
        const type = req.query.type || null;
        const mood = req.query.mood || null;
        
        const result = await Destination.paginateActive(page, limit, type, mood);
        res.json(result);
    }

    // --- JOURNEY API ---
    async journey(req, res) {
        const body = req.body;
        const sessionUuid = body.sessionUuid || req.cookies.session_uuid;
        const mood = body.mood || 'an_nhien';
        
        if (!sessionUuid) return res.status(400).json({ success: false, message: 'Missing sessionUuid' });
        
        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
        
        try {
            // Note: In PHP it called createFromMood, here we use createPersonalized or similar
            // Assuming we want a personalized one if data exists
            const interests = session.interests ? JSON.parse(session.interests) : [];
            const duration = session.duration || 'half_day';
            
            const journey = await Journey.createPersonalized(session.id, mood, duration, interests);
            
            // KPI Tracking: Log journey creation
            await UserSession.db.query(
                "INSERT INTO analytics (id, session_id, event, metadata) VALUES (?, ?, ?, ?)",
                [uuidv4(), session.id, 'journey_created', JSON.stringify({ mood, duration, stop_count: journey.stops.length })]
            );

            res.json({ success: true, data: journey });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    async updateJourneyStop(req, res) {
        const { journeyId, destinationId, action, order } = req.body;
        const JourneyStop = require('../models/JourneyStop');
        
        try {
            if (action === 'remove') {
                await JourneyStop.remove(journeyId, destinationId);
            } else if (action === 'reorder') {
                await JourneyStop.updateOrder(journeyId, destinationId, order);
            } else if (action === 'update_transport') {
                const transport = req.body.transport || 'walking';
                await UserSession.db.query(
                    "UPDATE journey_stops SET transport = ? WHERE journey_id = ? AND destination_id = ?",
                    [transport, journeyId, destinationId]
                );
            }
            
            // Recalculate journey totals
            await Journey.recalculateMetrics(journeyId);
            
            res.json({ success: true });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    // --- CHECK-IN API ---
    async checkin(req, res) {
        if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
        
        const body = req.body;
        const sessionUuid = body.sessionUuid || req.cookies.session_uuid;
        const slug = body.slug || null;
        const lat = parseFloat(body.lat) || null;
        const lng = parseFloat(body.lng) || null;
        const method = body.method || 'qr';
        
        if (!sessionUuid || !slug || lat === null || lng === null) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không đầy đủ' });
        }

        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        const dest = await Destination.findBySlug(slug);
        if (!dest) return res.status(404).json({ success: false, message: 'Điểm đến không tồn tại' });

        // Verify distance
        const distance = Model.haversine(lat, lng, dest.lat, dest.lng);
        if (distance > dest.radius_meter * 1.5) {
            return res.status(400).json({ success: false, message: `Bạn đang cách quá xa địa điểm (${Math.round(distance)}m)` });
        }

        if (await CheckIn.existsForStop(session.id, dest.id)) {
            return res.status(400).json({ success: false, message: 'Bạn đã check-in điểm này rồi' });
        }

        // Perform check-in
        await CheckIn.create({
            session_id: session.id,
            destination_id: dest.id,
            points_earned: dest.points,
            checkin_method: method,
            user_lat: lat,
            user_lng: lng,
            distance_meter: Math.round(distance)
        });

        // Update total points in session
        await UserSession.addPoints(session.id, dest.points);

        // Mark journey stop as completed if applicable
        const journey = await Journey.getActiveBySession(session.id);
        if (journey) {
            await UserSession.db.query(
                "UPDATE journey_stops SET is_completed = 1, completed_at = NOW() WHERE journey_id = ? AND destination_id = ?",
                [journey.id, dest.id]
            );
        }

        // Check badges
        const newBadges = await UserBadge.checkAndUnlock(session.id);

        res.json({
            success: true,
            points_earned: dest.points,
            new_badges: newBadges,
            destination: {
                name: dest.name,
                story: dest.story,
                audio_url: dest.audio_url,
                video_url: dest.video_url,
                cover_image: dest.cover_image,
                highlight: dest.highlight
            }
        });
    }

    // --- CHAT API ---
    async sendMessage(req, res) {
        const { destinationId, message } = req.body;
        const sessionUuid = req.cookies.session_uuid;
        
        if (!sessionUuid || !destinationId || !message) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không đầy đủ' });
        }

        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        // Get manager for this destination
        const [managers] = await UserSession.db.query(
            "SELECT id FROM users WHERE managed_destination_id = ? AND role = 'manager' LIMIT 1",
            [destinationId]
        );
        const receiverId = managers.length > 0 ? managers[0].id : null;

        await UserSession.db.query(
            "INSERT INTO messages (id, sender_id, receiver_id, destination_id, message) VALUES (?, ?, ?, ?, ?)",
            [uuidv4(), session.id, receiverId, destinationId, message]
        );

        res.json({ success: true, message: 'Đã gửi tin nhắn đến quản lý địa điểm.' });
    }
}

module.exports = new ApiController();
