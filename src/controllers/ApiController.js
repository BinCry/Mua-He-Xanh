const UserSession = require('../models/UserSession');
const Destination = require('../models/Destination');
const Journey = require('../models/Journey');
const CheckIn = require('../models/CheckIn');
const UserBadge = require('../models/UserBadge');
const Model = require('../core/Model');
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

const CHECKIN_RADIUS_METERS = 50000; // 50km (50,000 meters)

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

        const authenticatedUser = req.user || req.session?.user || null;
        const userId = authenticatedUser?.id || session.user_id || null;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập tài khoản để thực hiện quét mã check-in tích điểm!',
                error_type: 'AUTH_REQUIRED',
                login_url: '/auth/login?redirect=' + encodeURIComponent('/checkin' + (slug ? `?slug=${slug}` : ''))
            });
        }

        const dest = await Destination.findBySlug(slug);
        if (!dest) {
            return res.status(404).json({ success: false, message: 'Địa điểm không hợp lệ' });
        }

        const distance = Model.haversine(lat, lng, dest.lat, dest.lng);
        const maxRadius = Math.max(Number(dest.radius_meter) || 0, CHECKIN_RADIUS_METERS);
        
        if (distance > maxRadius) {
            return res.status(400).json({ success: false, message: 'Nằm ngoài bán kính địa điểm', error_type: 'OUT_OF_RADIUS' });
        }

        try {
            const recentCheckin = await CheckIn.existsRecentCheckIn(session.id, dest.id, userId, 24);
            if (recentCheckin) {
                const createdAt = new Date(recentCheckin.created_at).getTime();
                const resetAt = createdAt + (24 * 60 * 60 * 1000);
                const remainingMs = resetAt - Date.now();
                const remainingHours = Math.max(0, Math.floor(remainingMs / (1000 * 60 * 60)));
                const remainingMinutes = Math.max(1, Math.ceil((remainingMs % (1000 * 60 * 60)) / (1000 * 60)));
                
                const timeText = remainingHours > 0 
                    ? `${remainingHours} giờ ${remainingMinutes} phút` 
                    : `${remainingMinutes} phút`;

                return res.status(400).json({ 
                    success: false, 
                    message: `Bạn đã check-in địa điểm này rồi. Hệ thống sẽ mở lại sau ${timeText} (Mỗi 24 giờ được check-in 1 lần).`, 
                    error_type: 'ALREADY_CHECKED_IN',
                    reset_in: timeText
                });
            }

            await CheckIn.create({
                session_id: session.id,
                user_id: userId,
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
        try {
            const user = req.user || req.session?.user || null;
            if (!user) {
                return res.status(401).json({ 
                    success: false, 
                    requireLogin: true, 
                    message: 'Vui lòng đăng nhập tài khoản để nhắn tin trò chuyện!' 
                });
            }

            const { destinationId, message } = req.body;
            let sessionUuid = req.cookies?.session_uuid;
            
            if (!sessionUuid) {
                sessionUuid = uuidv4();
                res.cookie('session_uuid', sessionUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
            }

            if (!message || !message.trim()) {
                return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
            }

            const session = await UserSession.findOrCreate(sessionUuid, req);
            if (!session) return res.status(404).json({ success: false, message: 'Không thể tạo phiên truy cập.' });

            const currentUserId = user.id;

            if (user.id && !session.user_id) {
                await db.query("UPDATE user_sessions SET user_id = $1 WHERE id = $2", [user.id, session.id]);
                session.user_id = user.id;
            }

            // Check message count for this session BEFORE saving current message
            const [existingMsgs] = await db.query(
                "SELECT COUNT(*) as total FROM messages WHERE receiver_uuid = $1 OR sender_uuid = $1",
                [session.id]
            );
            const msgCount = parseInt(existingMsgs[0]?.total || 0, 10);

            let receiverUuid = null;
            if (destinationId) {
                const [managers] = await db.query(
                    "SELECT id FROM users WHERE managed_destination_id = $1 AND role = 'manager' LIMIT 1",
                    [destinationId]
                );
                receiverUuid = managers.length > 0 ? managers[0].id : null;
            }

            await db.query(
                "INSERT INTO messages (id, sender_id, sender_uuid, receiver_uuid, destination_id, message, content, created_at) VALUES ($1, $2, $3, $4, $5, $6, $6, NOW())",
                [uuidv4(), currentUserId, session.id, receiverUuid, destinationId || null, message.trim()]
            );

            res.json({ success: true, message: 'Tin nhắn đã được gửi thành công.' });
        } catch(err) {
            console.error("SendMessage Error:", err);
            res.status(500).json({ success: false, message: 'Lỗi gửi tin nhắn: ' + err.message });
        }
    }

    async replyMessage(req, res) {
        try {
            const { messageId, sessionId, replyText, destinationId } = req.body;
            const manager = req.session?.user || req.user;

            if (!manager || (manager.role !== 'manager' && manager.role !== 'admin')) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }

            if (!replyText || !replyText.trim()) {
                return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được để trống.' });
            }

            let receiverUuid = null;
            let finalDestId = destinationId || manager.managed_destination_id || null;

            if (sessionId) {
                receiverUuid = sessionId;
            } else if (messageId) {
                const [rows] = await db.query("SELECT * FROM messages WHERE id = $1", [messageId]);
                if (rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
                const originalMsg = rows[0];
                receiverUuid = originalMsg.sender_uuid;
                finalDestId = originalMsg.destination_id || finalDestId;
            } else {
                return res.status(400).json({ success: false, message: 'Thiếu thông tin người nhận' });
            }

            await db.query(
                "INSERT INTO messages (id, sender_id, receiver_uuid, destination_id, message, content, created_at) VALUES ($1, $2, $3, $4, $5, $5, NOW())",
                [uuidv4(), manager.id, receiverUuid, finalDestId, replyText.trim()]
            );

            res.json({ success: true, message: 'Đã gửi phản hồi.' });
        } catch(err) {
            console.error("ReplyMessage Error:", err);
            res.status(500).json({ success: false, message: 'Lỗi gửi phản hồi: ' + err.message });
        }
    }

    async deleteConversation(req, res) {
        try {
            const user = req.user || req.session?.user;
            if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
            }

            const { session_id, destination_id } = req.body;
            if (!session_id) {
                return res.status(400).json({ success: false, message: 'Thiếu ID hội thoại.' });
            }

            const targetDestId = destination_id || (user.role === 'manager' ? user.managed_destination_id : null);

            if (targetDestId) {
                await db.query(
                    "DELETE FROM messages WHERE (sender_uuid = $1 OR receiver_uuid = $1) AND destination_id = $2",
                    [String(session_id), String(targetDestId)]
                );
            } else {
                await db.query(
                    "DELETE FROM messages WHERE sender_uuid = $1 OR receiver_uuid = $1",
                    [String(session_id)]
                );
            }

            res.json({ success: true, message: 'Đã xóa cuộc hội thoại thành công!' });
        } catch(err) {
            console.error("Delete conversation error:", err);
            res.status(500).json({ success: false, message: 'Lỗi xóa hội thoại: ' + err.message });
        }
    }

    async recallMessage(req, res) {
        try {
            const { messageId, type } = req.body; // 'all' (Thu hồi với mọi người) | 'self' (Gỡ ở phía bạn)
            if (!messageId) {
                return res.status(400).json({ success: false, message: 'Thiếu ID tin nhắn.' });
            }

            const sessionUuid = req.cookies?.session_uuid;
            const user = req.user || req.session?.user;
            const currentUserId = user?.id;
            const currentRole = user?.role;

            let session = null;
            if (sessionUuid) {
                session = await UserSession.findOrCreate(sessionUuid, req);
            }

            const [rows] = await db.query("SELECT * FROM messages WHERE id::text = $1", [String(messageId)]);
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy tin nhắn.' });
            }

            const msg = rows[0];

            if (type === 'all') {
                let canRecall = false;
                if (currentRole === 'admin') canRecall = true;
                else if (currentRole === 'manager' && (!msg.destination_id || msg.destination_id === user?.managed_destination_id)) canRecall = true;
                else if (currentUserId && String(msg.sender_id) === String(currentUserId)) canRecall = true;
                else if (session && (String(msg.sender_uuid) === String(session.id) || String(msg.sender_uuid) === String(session.uuid))) canRecall = true;
                else if (sessionUuid && (String(msg.sender_uuid) === String(sessionUuid))) canRecall = true;

                if (!canRecall) {
                    return res.status(403).json({ success: false, message: 'Bạn không có quyền thu hồi tin nhắn này với mọi người.' });
                }

                await db.query(
                    "UPDATE messages SET is_recalled = 1, message = '[ĐÃ THU HỒI]', content = '[ĐÃ THU HỒI]' WHERE id::text = $1",
                    [String(messageId)]
                );

                return res.json({ success: true, type: 'all', message: 'Đã thu hồi tin nhắn với mọi người.' });
            } else {
                const userTag = currentUserId ? `user_${currentUserId}` : '';
                const sessTag = session ? `sess_${session.uuid || session.id}` : (sessionUuid ? `sess_${sessionUuid}` : '');
                const sessIdTag = session ? `sess_${session.id}` : '';

                const existing = msg.deleted_for || '';
                const parts = existing ? existing.split(',') : [];
                if (userTag && !parts.includes(userTag)) parts.push(userTag);
                if (sessTag && !parts.includes(sessTag)) parts.push(sessTag);
                if (sessIdTag && !parts.includes(sessIdTag)) parts.push(sessIdTag);
                const updated = parts.join(',');

                await db.query(
                    "UPDATE messages SET deleted_for = $1 WHERE id::text = $2",
                    [updated, String(messageId)]
                );

                return res.json({ success: true, type: 'self', message: 'Đã gỡ tin nhắn ở phía bạn.' });
            }
        } catch(err) {
            console.error("Recall message error:", err);
            res.status(500).json({ success: false, message: 'Lỗi thu hồi tin nhắn: ' + err.message });
        }
    }

    async getMessages(req, res) {
        let sessionUuid = req.cookies?.session_uuid;
        if (!sessionUuid) {
            sessionUuid = uuidv4();
            res.cookie('session_uuid', sessionUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
        }

        const session = await UserSession.findOrCreate(sessionUuid, req);
        if (!session) return res.json({ success: true, data: [] });

        const user = req.user || req.session?.user || null;
        const currentUserId = user ? user.id : (session.user_id || null);

        if (user && user.id && !session.user_id) {
            await db.query("UPDATE user_sessions SET user_id = $1 WHERE id = $2", [user.id, session.id]);
            session.user_id = user.id;
        }

        const queryParams = [String(session.id), String(session.uuid || session.id)];
        
        let userCondition = '';
        if (currentUserId) {
            queryParams.push(currentUserId);
            userCondition = `OR sender_id = $${queryParams.length}`;
        }

        const { destinationId } = req.query;
        let destCondition = '';
        if (destinationId) {
            queryParams.push(String(destinationId));
            destCondition = `AND destination_id = $${queryParams.length}`;
        } else if (req.query.scope === 'global' || req.query.global === 'true') {
            destCondition = `AND (destination_id IS NULL OR destination_id = '')`;
        }

        const [messages] = await db.query(
            `SELECT m.id, m.sender_id, m.sender_uuid, m.receiver_uuid, m.destination_id, 
                    COALESCE(m.message, m.content, '') as message, m.is_ai, m.created_at,
                    COALESCE(m.is_recalled, 0) as is_recalled, COALESCE(m.deleted_for, '') as deleted_for,
                    d.name as destination_name, d.cover_image as destination_image,
                    mgr.full_name as manager_name, mgr.avatar as manager_avatar
              FROM messages m
              LEFT JOIN destinations d ON m.destination_id = d.id
              LEFT JOIN users mgr ON m.sender_id = mgr.id
              WHERE (
                m.sender_uuid = $1 OR m.receiver_uuid = $1 OR m.sender_uuid = $2 OR m.receiver_uuid = $2
                ${userCondition}
              )
              ${destCondition}
              ORDER BY m.created_at ASC`,
            queryParams
        );

        const userTag = currentUserId ? `user_${currentUserId}` : '';
        const sessTag = `sess_${session.uuid || session.id}`;
        const sessIdTag = `sess_${session.id}`;

        const formatted = messages
            .filter(m => {
                const deletedList = (m.deleted_for || '').split(',');
                if (userTag && deletedList.includes(userTag)) return false;
                if (deletedList.includes(sessTag) || deletedList.includes(sessIdTag)) return false;
                return true;
            })
            .map(m => {
                const isAi = (m.is_ai === 1 || m.is_ai === true);
                let isMine = false;

                if (!isAi) {
                    if ((m.sender_uuid && (String(m.sender_uuid) === String(session.id) || String(m.sender_uuid) === String(session.uuid))) ||
                        (m.sender_id && currentUserId && String(m.sender_id) === String(currentUserId))) {
                        isMine = true;
                    }
                }

                const isRecalled = (m.is_recalled === 1 || m.message === '[ĐÃ THU HỒI]');

                return {
                    ...m,
                    is_mine: isMine,
                    is_recalled: isRecalled,
                    message: isRecalled ? '[ĐÃ THU HỒI]' : m.message
                };
            });

        res.json({ success: true, data: formatted });
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

    async getRealtimeStats(req, res) {
        try {
            const [[uv], [ck], [dest], [avg]] = await Promise.all([
                db.query("SELECT COALESCE(NULLIF((SELECT COUNT(*) FROM analytics WHERE event = 'session_start'), 0), (SELECT COUNT(DISTINCT session_id) FROM analytics), 1) as total").catch(() => [[{ total: 0 }]]),
                db.query('SELECT COUNT(*) as total FROM check_ins').catch(() => [[{ total: 0 }]]),
                db.query('SELECT COUNT(*) as total FROM destinations WHERE is_active = 1').catch(() => [[{ total: 10 }]]),
                db.query('SELECT AVG(rating) as avg, COUNT(*) as count FROM reviews').catch(() => [[{ avg: null, count: 0 }]])
            ]);

            const visitors = parseInt(uv[0]?.total ?? 0, 10);
            const checkins = parseInt(ck[0]?.total ?? 0, 10);
            const destinations = parseInt(dest[0]?.total ?? 10, 10);
            
            const reviewCount = parseInt(avg[0]?.count ?? 0, 10);
            let avgRating = '5.0';
            if (reviewCount > 0 && avg[0]?.avg !== null) {
                avgRating = (Math.round(parseFloat(avg[0].avg) * 10) / 10).toFixed(1);
            }

            res.json({
                success: true,
                stats: {
                    visitors,
                    checkins,
                    destinations,
                    avgRating
                }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ApiController();
