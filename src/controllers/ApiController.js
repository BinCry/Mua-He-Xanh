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
                mood: body.moods || body.mood || null,
                duration: body.duration || null,
                pax: body.pax || 1,
                budget: body.budget || 'medium',
                season: body.season || 'now',
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
            const interests = session.interests ? JSON.parse(session.interests) : [];
            const duration = session.duration || 'half_day';
            
            const journey = await Journey.createPersonalized(session.id, mood, duration, interests);
            
            // KPI Tracking
            await UserSession.db.query(
                "INSERT INTO analytics (id, session_id, event, metadata) VALUES (?, ?, ?, ?)",
                [uuidv4(), session.id, 'journey_created', JSON.stringify({ mood, duration, stop_count: journey.stops.length })]
            );

            res.json({ success: true, data: journey });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    }

    /** Update journey stop (reorder, remove, or add) */
    async updateJourneyStop(req, res) {
        const { journeyId, action, order, destinationId } = req.body;
        const JourneyStop = require('../models/JourneyStop');
        
        try {
            if (action === 'reorder' && order) {
                for (let i = 0; i < order.length; i++) {
                    await JourneyStop.updateByJourneyAndDest(journeyId, order[i], { stop_order: i });
                }
            } else if (action === 'remove' && destinationId) {
                await Journey.removeStop(journeyId, destinationId);
            } else if (action === 'add' && destinationId) {
                // Check if already in journey stops
                const [existing] = await UserSession.db.query(
                    "SELECT id FROM journey_stops WHERE journey_id = ? AND destination_id = ?",
                    [journeyId, destinationId]
                );
                if (existing.length === 0) {
                    const [rows] = await UserSession.db.query(
                        "SELECT MAX(stop_order) as max_order FROM journey_stops WHERE journey_id = ?",
                        [journeyId]
                    );
                    const nextOrder = (rows[0] && rows[0].max_order !== null) ? rows[0].max_order + 1 : 0;
                    await JourneyStop.create({
                        journey_id: journeyId,
                        destination_id: destinationId,
                        stop_order: nextOrder,
                        is_completed: 0
                    });
                }
            }

            await Journey.recalculateMetrics(journeyId);
            res.json({ success: true });
        } catch (error) {
            console.error("Update stop error:", error);
            res.status(500).json({ success: false, error: error.message });
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
        console.log(`[CHECKIN DEBUG] Received slug: "${slug}", Found: ${dest ? dest.name : 'NULL'}`);
        if (!dest) {
            const [allDests] = await UserSession.db.query('SELECT slug, qr_secret, name FROM destinations WHERE is_active = 1');
            console.log('[CHECKIN DEBUG] Available:', allDests.map(d => d.slug).join(', '));
            return res.status(404).json({ success: false, message: `Mã QR không hợp lệ. Vui lòng quét mã QR chính thức từ hệ thống. (Dữ liệu nhận: "${slug}")` });
        }

        const distance = Model.haversine(lat, lng, dest.lat, dest.lng);
        const maxRadius = Math.max(dest.radius_meter || 100, 500) * 2; // Tối thiểu 500m, nhân 2 cho dung sai GPS
        console.log(`[CHECKIN] Distance: ${Math.round(distance)}m, MaxRadius: ${maxRadius}m, DestCoords: (${dest.lat}, ${dest.lng}), UserCoords: (${lat}, ${lng})`);
        
        if (distance > maxRadius) {
            return res.status(400).json({ 
                success: false, 
                message: `Bạn đang cách địa điểm "${dest.name}" khoảng ${Math.round(distance)}m. Vui lòng đến gần hơn (trong phạm vi ${maxRadius}m) để check-in.` 
            });
        }

        try {
            if (await CheckIn.existsForStop(session.id, dest.id)) {
                return res.status(400).json({ success: false, message: 'Bạn đã check-in điểm này rồi' });
            }

            await CheckIn.create({
                session_id: session.id,
                destination_id: dest.id,
                points_earned: dest.points,
                checkin_method: method,
                user_lat: lat,
                user_lng: lng,
                distance_meter: Math.round(distance)
            });

            await UserSession.addPoints(session.id, dest.points);

            const journey = await Journey.getActiveBySession(session.id);
            if (journey) {
                await UserSession.db.query(
                    "UPDATE journey_stops SET is_completed = 1, completed_at = NOW() WHERE journey_id = ? AND destination_id = ?",
                    [journey.id, dest.id]
                );
            }

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
        } catch (err) {
            console.error('[CHECKIN ERROR]', err);
            return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi check-in: ' + err.message });
        }
    }

    // --- CHAT API ---
    async sendMessage(req, res) {
        const { destinationId, message } = req.body;
        const sessionUuid = req.cookies.session_uuid;
        
        if (!sessionUuid || !message) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không đầy đủ' });
        }

        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        let receiverId = null;
        if (destinationId) {
            // Route to Manager
            const [managers] = await UserSession.db.query(
                "SELECT id FROM users WHERE managed_destination_id = ? AND role = 'manager' LIMIT 1",
                [destinationId]
            );
            receiverId = managers.length > 0 ? managers[0].id : null;
        } else {
            // Route to Admin
            const [admins] = await UserSession.db.query(
                "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
            );
            receiverId = admins.length > 0 ? admins[0].id : null;
        }

        // Save user message (use session_uuid for guest identification in sender_uuid field if needed)
        await UserSession.db.query(
            "INSERT INTO messages (id, sender_id, sender_uuid, receiver_id, destination_id, message) VALUES (?, ?, ?, ?, ?, ?)",
            [uuidv4(), session.user_id || null, session.id, receiverId, destinationId || null, message]
        );

        // Optional AI Brain response (only for destination-specific chat)
        let aiReply = null;
        if (destinationId) {
            const AIBrain = require('../core/AIBrain');
            aiReply = await AIBrain.generateResponse(message, destinationId);
            
            await UserSession.db.query(
                "INSERT INTO messages (id, sender_id, receiver_id, destination_id, message, is_ai) VALUES (?, ?, ?, ?, ?, ?)",
                [uuidv4(), null, session.id, destinationId, aiReply, 1]
            );
        }

        res.json({ success: true, message: aiReply || 'Tin nhắn đã được gửi đến quản trị viên.' });
    }

    async replyMessage(req, res) {
        const { messageId, sessionId, replyText, destinationId } = req.body;
        const manager = req.session.user || req.user;

        if (!manager || (manager.role !== 'manager' && manager.role !== 'admin')) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }

        if (!replyText) {
            return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được để trống.' });
        }

        let receiverId = null;
        let receiverUuid = null;
        let finalDestId = destinationId || null;

        if (sessionId) {
            receiverUuid = sessionId;
            const [sessions] = await UserSession.db.query("SELECT user_id FROM user_sessions WHERE id = ?", [sessionId]);
            if (sessions.length > 0) {
                receiverId = sessions[0].user_id;
            }
        } else if (messageId) {
            const [rows] = await UserSession.db.query("SELECT * FROM messages WHERE id = ?", [messageId]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
            const originalMsg = rows[0];
            receiverUuid = originalMsg.sender_uuid;
            receiverId = originalMsg.sender_id;
            finalDestId = originalMsg.destination_id;
        } else {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin người nhận (sessionId hoặc messageId)' });
        }

        await UserSession.db.query(
            "INSERT INTO messages (id, sender_id, receiver_id, receiver_uuid, destination_id, message) VALUES (?, ?, ?, ?, ?, ?)",
            [uuidv4(), manager.id, receiverId, receiverUuid, finalDestId, replyText]
        );

        res.json({ success: true, message: 'Đã gửi phản hồi.' });
    }

    async getMessages(req, res) {
        const { destinationId } = req.query;
        const sessionUuid = req.cookies.session_uuid;

        if (!sessionUuid) return res.json({ success: true, data: [] });

        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.json({ success: true, data: [] });

        const queryParams = [
            session.id, session.id, 
            session.uuid, session.uuid, 
            session.id, session.id
        ];
        
        let userCondition = '';
        if (session.user_id) {
            userCondition = 'OR sender_id = ? OR receiver_id = ?';
            queryParams.push(session.user_id, session.user_id);
        }

        if (destinationId) {
            queryParams.push(destinationId);
        }

        const [messages] = await UserSession.db.query(
            `SELECT * FROM messages 
              WHERE (
                sender_uuid = ? OR receiver_uuid = ? 
                OR sender_uuid = ? OR receiver_uuid = ?
                OR receiver_id = ? OR sender_id = ?
                ${userCondition}
              )
              AND (destination_id ${destinationId ? '= ?' : 'IS NULL'})
              ORDER BY created_at ASC`,
            queryParams
        );

        res.json({ success: true, data: messages });
    }

    async getSoundscapes(req, res) {
        try {
            const db = require('../core/database');
            const [soundscapes] = await db.query(
                "SELECT * FROM soundscapes WHERE is_active = 1 ORDER BY created_at DESC"
            );
            res.json({ success: true, data: soundscapes });
        } catch (error) {
            console.error("API get soundscapes error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // --- DESTINATION INTERACTIONS API ---
    async like(req, res) {
        const { destinationId } = req.body;
        const user = req.user || req.session?.user;

        if (!user) {
            return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thích địa điểm.' });
        }
        if (!destinationId) {
            return res.status(400).json({ success: false, message: 'Thiếu ID địa điểm.' });
        }

        try {
            const [rows] = await UserSession.db.query(
                "SELECT id FROM destination_likes WHERE user_id = ? AND destination_id = ?",
                [user.id, destinationId]
            );

            let liked = false;
            if (rows.length > 0) {
                await UserSession.db.query(
                    "DELETE FROM destination_likes WHERE user_id = ? AND destination_id = ?",
                    [user.id, destinationId]
                );
                liked = false;
            } else {
                await UserSession.db.query(
                    "INSERT INTO destination_likes (id, user_id, destination_id) VALUES (?, ?, ?)",
                    [uuidv4(), user.id, destinationId]
                );
                liked = true;
            }

            const [countRows] = await UserSession.db.query(
                "SELECT COUNT(*) as count FROM destination_likes WHERE destination_id = ?",
                [destinationId]
            );
            const likesCount = countRows[0]?.count || 0;

            res.json({ success: true, liked, likesCount });
        } catch (error) {
            console.error("Like destination error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async save(req, res) {
        const { destinationId } = req.body;
        const user = req.user || req.session?.user;

        if (!user) {
            return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để lưu địa điểm.' });
        }
        if (!destinationId) {
            return res.status(400).json({ success: false, message: 'Thiếu ID địa điểm.' });
        }

        try {
            const [rows] = await UserSession.db.query(
                "SELECT id FROM user_favorites WHERE user_id = ? AND destination_id = ?",
                [user.id, destinationId]
            );

            let saved = false;
            if (rows.length > 0) {
                await UserSession.db.query(
                    "DELETE FROM user_favorites WHERE user_id = ? AND destination_id = ?",
                    [user.id, destinationId]
                );
                saved = false;
            } else {
                await UserSession.db.query(
                    "INSERT INTO user_favorites (id, user_id, destination_id) VALUES (?, ?, ?)",
                    [uuidv4(), user.id, destinationId]
                );
                saved = true;
            }

            res.json({ success: true, saved });
        } catch (error) {
            console.error("Save destination error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async addToJourney(req, res) {
        const { destinationId } = req.body;
        const sessionUuid = req.cookies.session_uuid;

        if (!sessionUuid || !destinationId) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không đầy đủ.' });
        }

        try {
            const session = await UserSession.findByUuid(sessionUuid);
            if (!session) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy session.' });
            }

            let journey = await Journey.getActiveBySession(session.id);
            if (!journey) {
                const journeyId = await Journey.create({
                    session_id: session.id,
                    mood: 'Hành trình tự chọn',
                    duration: 'half_day',
                    total_km: 0,
                    total_minutes: 60,
                    status: 'active',
                    interests: '[]'
                });
                journey = { id: journeyId };
            }

            const [existing] = await UserSession.db.query(
                "SELECT id FROM journey_stops WHERE journey_id = ? AND destination_id = ?",
                [journey.id, destinationId]
            );

            if (existing.length === 0) {
                const [rows] = await UserSession.db.query(
                    "SELECT MAX(stop_order) as max_order FROM journey_stops WHERE journey_id = ?",
                    [journey.id]
                );
                const nextOrder = (rows[0] && rows[0].max_order !== null) ? rows[0].max_order + 1 : 0;
                
                const JourneyStop = require('../models/JourneyStop');
                await JourneyStop.create({
                    journey_id: journey.id,
                    destination_id: destinationId,
                    stop_order: nextOrder,
                    is_completed: 0
                });

                await Journey.recalculateMetrics(journey.id);
                return res.json({ success: true, message: 'Đã thêm địa điểm vào hành trình.' });
            } else {
                return res.json({ success: true, message: 'Địa điểm đã có trong hành trình của bạn.' });
            }
        } catch (error) {
            console.error("Add to journey error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ApiController();

