const UserSession = require('../models/UserSession');
const Destination = require('../models/Destination');
const Journey = require('../models/Journey');
const CheckIn = require('../models/CheckIn');
const UserBadge = require('../models/UserBadge');
const Model = require('../core/Model');
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

class ApiController {
    
    // --- SESSION API ---
    async session(req, res) {
        const { uuid } = req.params;
        
        if (req.method === 'POST') {
            const body = req.body;
            let currentUuid = req.cookies?.session_uuid || uuid;
            
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
        const sessionUuid = body.sessionUuid || req.cookies?.session_uuid;
        const mood = body.mood || 'an_nhien';
        
        if (!sessionUuid) return res.status(400).json({ success: false, message: 'Missing sessionUuid' });
        
        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });
        
        try {
            const interests = session.interests ? JSON.parse(session.interests) : [];
            const duration = session.duration || 'half_day';
            
            const journey = await Journey.createPersonalized(session.id, mood, duration, interests);
            
            await db.query(
                "INSERT INTO analytics (id, session_id, event, metadata) VALUES ($1, $2, $3, $4)",
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
                const [existing] = await db.query(
                    "SELECT id FROM journey_stops WHERE journey_id = $1 AND destination_id = $2",
                    [journeyId, destinationId]
                );
                if (existing.length === 0) {
                    const [rows] = await db.query(
                        "SELECT MAX(stop_order) as max_order FROM journey_stops WHERE journey_id = $1",
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
        const sessionUuid = body.sessionUuid || req.cookies?.session_uuid;
        const slug = body.slug || null;
        const lat = parseFloat(body.lat) || null;
        const lng = parseFloat(body.lng) || null;
        const method = body.method || 'qr';
        
        if (!sessionUuid || !slug || lat === null || lng === null) {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin xác thực' });
        }

        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        const dest = await Destination.findBySlug(slug);
        if (!dest) {
            return res.status(404).json({ success: false, message: 'Địa điểm không hợp lệ' });
        }

        const distance = Model.haversine(lat, lng, dest.lat, dest.lng);
        const maxRadius = dest.radius_meter || 100;
        
        if (distance > maxRadius) {
            return res.status(400).json({ success: false, message: 'Nằm ngoài bán kính địa điểm', error_type: 'OUT_OF_RADIUS' });
        }

        try {
            if (await CheckIn.existsForStop(session.id, dest.id)) {
                return res.status(400).json({ success: false, message: 'Bạn đã xác thực địa điểm này rồi', error_type: 'ALREADY_CHECKED_IN' });
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
                await db.query(
                    "UPDATE journey_stops SET is_completed = 1, completed_at = NOW() WHERE journey_id = $1 AND destination_id = $2",
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
            return res.status(500).json({ success: false, message: 'Xác thực thất bại' });
        }
    }

    // --- CHAT API ---
    async sendMessage(req, res) {
        const { destinationId, message } = req.body;
        const sessionUuid = req.cookies?.session_uuid;
        
        if (!sessionUuid || !message) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không đầy đủ' });
        }

        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

        let receiverId = null;
        if (destinationId) {
            const [managers] = await db.query(
                "SELECT id FROM users WHERE managed_destination_id = $1 AND role = 'manager' LIMIT 1",
                [destinationId]
            );
            receiverId = managers.length > 0 ? managers[0].id : null;
        } else {
            const [admins] = await db.query(
                "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
            );
            receiverId = admins.length > 0 ? admins[0].id : null;
        }

        await db.query(
            "INSERT INTO messages (id, sender_id, sender_uuid, receiver_id, destination_id, message) VALUES ($1, $2, $3, $4, $5, $6)",
            [uuidv4(), session.user_id || null, session.id, receiverId, destinationId || null, message]
        );

        let aiReply = null;
        if (destinationId) {
            const AIBrain = require('../core/AIBrain');
            aiReply = await AIBrain.generateResponse(message, destinationId);
            
            await db.query(
                "INSERT INTO messages (id, sender_id, receiver_id, destination_id, message, is_ai) VALUES ($1, $2, $3, $4, $5, $6)",
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
            const [sessions] = await db.query("SELECT user_id FROM user_sessions WHERE id = $1", [sessionId]);
            if (sessions.length > 0) {
                receiverId = sessions[0].user_id;
            }
        } else if (messageId) {
            const [rows] = await db.query("SELECT * FROM messages WHERE id = $1", [messageId]);
            if (rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
            const originalMsg = rows[0];
            receiverUuid = originalMsg.sender_uuid;
            receiverId = originalMsg.sender_id;
            finalDestId = originalMsg.destination_id;
        } else {
            return res.status(400).json({ success: false, message: 'Thiếu thông tin người nhận (sessionId hoặc messageId)' });
        }

        await db.query(
            "INSERT INTO messages (id, sender_id, receiver_id, receiver_uuid, destination_id, message) VALUES ($1, $2, $3, $4, $5, $6)",
            [uuidv4(), manager.id, receiverId, receiverUuid, finalDestId, replyText]
        );

        res.json({ success: true, message: 'Đã gửi phản hồi.' });
    }

    async getMessages(req, res) {
        const { destinationId } = req.query;
        const sessionUuid = req.cookies?.session_uuid;

        if (!sessionUuid) return res.json({ success: true, data: [] });

        const session = await UserSession.findByUuid(sessionUuid);
        if (!session) return res.json({ success: true, data: [] });

        const queryParams = [
            session.id, session.id, 
            session.uuid, session.uuid, 
            session.id, session.id
        ];
        
        let userCondition = '';
        let destParamIndex = 7;
        if (session.user_id) {
            userCondition = 'OR sender_id = $7 OR receiver_id = $8';
            queryParams.push(session.user_id, session.user_id);
            destParamIndex = 9;
        }

        let destCondition = `AND destination_id IS NULL`;
        if (destinationId) {
            destCondition = `AND destination_id = $${destParamIndex}`;
            queryParams.push(destinationId);
        }

        const [messages] = await db.query(
            `SELECT * FROM messages 
              WHERE (
                sender_uuid = $1 OR receiver_uuid = $2 
                OR sender_uuid = $3 OR receiver_uuid = $4
                OR receiver_id = $5 OR sender_id = $6
                ${userCondition}
              )
              ${destCondition}
              ORDER BY created_at ASC`,
            queryParams
        );

        res.json({ success: true, data: messages });
    }

    async getSoundscapes(req, res) {
        try {
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
            const [rows] = await db.query(
                "SELECT id FROM destination_likes WHERE user_id = $1 AND destination_id = $2",
                [user.id, destinationId]
            );

            let liked = false;
            if (rows.length > 0) {
                await db.query(
                    "DELETE FROM destination_likes WHERE user_id = $1 AND destination_id = $2",
                    [user.id, destinationId]
                );
                liked = false;
            } else {
                await db.query(
                    "INSERT INTO destination_likes (id, user_id, destination_id) VALUES ($1, $2, $3)",
                    [uuidv4(), user.id, destinationId]
                );
                liked = true;
            }

            const [countRows] = await db.query(
                "SELECT COUNT(*) as count FROM destination_likes WHERE destination_id = $1",
                [destinationId]
            );
            const likesCount = parseInt(countRows[0]?.count || 0, 10);

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
            const [rows] = await db.query(
                "SELECT id FROM user_favorites WHERE user_id = $1 AND destination_id = $2",
                [user.id, destinationId]
            );

            let saved = false;
            if (rows.length > 0) {
                await db.query(
                    "DELETE FROM user_favorites WHERE user_id = $1 AND destination_id = $2",
                    [user.id, destinationId]
                );
                saved = false;
            } else {
                await db.query(
                    "INSERT INTO user_favorites (id, user_id, destination_id) VALUES ($1, $2, $3)",
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
        const user = req.user || req.session?.user;

        if (!user) {
            return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thêm địa điểm vào hành trình.' });
        }
        if (!destinationId) {
            return res.status(400).json({ success: false, message: 'Dữ liệu không đầy đủ.' });
        }

        const sessionUuid = req.cookies?.session_uuid;

        try {
            let session = sessionUuid ? await UserSession.findByUuid(sessionUuid) : null;
            if (!session) {
                const [userSessions] = await db.query("SELECT * FROM user_sessions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1", [user.id]);
                if (userSessions.length > 0) {
                    session = userSessions[0];
                } else {
                    const newUuid = uuidv4();
                    session = await UserSession.findOrCreate(newUuid, req);
                    await db.query("UPDATE user_sessions SET user_id = $1 WHERE id = $2", [user.id, session.id]);
                }
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

            const [existing] = await db.query(
                "SELECT id FROM journey_stops WHERE journey_id = $1 AND destination_id = $2",
                [journey.id, destinationId]
            );

            if (existing.length === 0) {
                const [rows] = await db.query(
                    "SELECT MAX(stop_order) as max_order FROM journey_stops WHERE journey_id = $1",
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
