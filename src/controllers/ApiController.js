const UserSession = require('../models/UserSession');
const Destination = require('../models/Destination');
const Journey = require('../models/Journey');
const CheckIn = require('../models/CheckIn');
const UserBadge = require('../models/UserBadge');
const Model = require('../core/Model');
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

const CHECKIN_RADIUS_METERS = 2000; // 2 km

function isAdminUser(user) {
    return Boolean(user) && (user.role === 'admin' || Number(user.role_id) === 1);
}

function isManagerUser(user) {
    return isAdminUser(user) || (Boolean(user) && (user.role === 'manager' || Number(user.role_id) === 2));
}

class ApiController {
    
    // --- SESSION API ---
    async session(req, res) {
        const { uuid } = req.params;
        const cookieUuid = req.cookies?.session_uuid;

        // A URL parameter is a selector, not a bearer credential.  Session
        // data may only be read or written through the visitor's HttpOnly
        // cookie, otherwise a copied UUID can be used across accounts.
        if (uuid && (!cookieUuid || String(uuid) !== String(cookieUuid))) {
            return res.status(403).json({ success: false, message: 'Phiên không thuộc trình duyệt hiện tại.' });
        }
        
        if (req.method === 'POST') {
            const body = req.body;
            let currentUuid = cookieUuid;
            
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
        const sessionUuid = req.cookies?.session_uuid;
        const mood = body.mood || 'an_nhien';
        const user = req.user || req.session?.user;
        
        if (!sessionUuid) return res.status(400).json({ success: false, message: 'Missing sessionUuid' });
        if (!user?.id) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để tạo hành trình.' });
        if (body.sessionUuid && body.sessionUuid !== sessionUuid) {
            return res.status(403).json({ success: false, message: 'Phiên hành trình không hợp lệ.' });
        }
        
        const [sessions] = await db.query(
            `SELECT * FROM user_sessions
             WHERE uuid = $1 AND user_id = $2
               AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
             LIMIT 1`,
            [sessionUuid, user.id]
        );
        const session = sessions[0];
        if (!session) return res.status(403).json({ success: false, message: 'Phiên hành trình không thuộc tài khoản hiện tại.' });
        
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
            console.error('Journey creation error:', e);
            res.status(500).json({ success: false, message: 'Không thể tạo hành trình lúc này.' });
        }
    }

    /** Update journey stop (reorder, remove, or add) */
    async updateJourneyStop(req, res) {
        const { journeyId, action, order, destinationId } = req.body;
        const user = req.user || req.session?.user;
        
        try {
            if (!user?.id || !journeyId || !['reorder', 'remove', 'add'].includes(action)) {
                return res.status(400).json({ success: false, message: 'Yêu cầu cập nhật hành trình không hợp lệ.' });
            }

            await db.transaction(async (tx) => {
                const [owned] = await tx.query(
                    `SELECT j.id, j.status FROM journeys j
                     JOIN user_sessions s ON s.id::text = j.session_id::text
                     WHERE j.id = $1 AND s.user_id = $2 FOR UPDATE`,
                    [journeyId, user.id]
                );
                if (!owned.length) {
                    const error = new Error('JOURNEY_NOT_OWNED');
                    error.code = 'JOURNEY_NOT_OWNED';
                    throw error;
                }
                if (owned[0].status !== 'active') {
                    const error = new Error('JOURNEY_LOCKED');
                    error.code = 'JOURNEY_LOCKED';
                    throw error;
                }

                const [currentStops] = await tx.query(
                    'SELECT destination_id, stop_order FROM journey_stops WHERE journey_id = $1 ORDER BY stop_order FOR UPDATE',
                    [journeyId]
                );

                if (action === 'reorder') {
                    if (!Array.isArray(order) || order.length !== currentStops.length || new Set(order).size !== order.length) {
                        const error = new Error('INVALID_STOP_ORDER');
                        error.code = 'INVALID_STOP_ORDER';
                        throw error;
                    }
                    const existingIds = new Set(currentStops.map(stop => String(stop.destination_id)));
                    if (order.some(id => !existingIds.has(String(id)))) {
                        const error = new Error('INVALID_STOP_ORDER');
                        error.code = 'INVALID_STOP_ORDER';
                        throw error;
                    }
                    // Avoid transient duplicate positions where deployments add a
                    // unique (journey_id, stop_order) constraint.
                    await tx.query('UPDATE journey_stops SET stop_order = stop_order + 1000 WHERE journey_id = $1', [journeyId]);
                    for (let index = 0; index < order.length; index += 1) {
                        await tx.query(
                            'UPDATE journey_stops SET stop_order = $1 WHERE journey_id = $2 AND destination_id = $3',
                            [index, journeyId, order[index]]
                        );
                    }
                } else if (action === 'remove') {
                    if (!destinationId || !currentStops.some(stop => String(stop.destination_id) === String(destinationId))) {
                        const error = new Error('STOP_NOT_FOUND');
                        error.code = 'STOP_NOT_FOUND';
                        throw error;
                    }
                    await tx.query('DELETE FROM journey_stops WHERE journey_id = $1 AND destination_id = $2', [journeyId, destinationId]);
                    const [remaining] = await tx.query('SELECT id FROM journey_stops WHERE journey_id = $1 ORDER BY stop_order FOR UPDATE', [journeyId]);
                    for (let index = 0; index < remaining.length; index += 1) {
                        await tx.query('UPDATE journey_stops SET stop_order = $1 WHERE id = $2', [index, remaining[index].id]);
                    }
                } else {
                    if (!destinationId) {
                        const error = new Error('DESTINATION_REQUIRED');
                        error.code = 'DESTINATION_REQUIRED';
                        throw error;
                    }
                    const [destinations] = await tx.query('SELECT id FROM destinations WHERE id = $1 AND is_active = 1 LIMIT 1', [destinationId]);
                    if (!destinations.length) {
                        const error = new Error('DESTINATION_UNAVAILABLE');
                        error.code = 'DESTINATION_UNAVAILABLE';
                        throw error;
                    }
                    if (!currentStops.some(stop => String(stop.destination_id) === String(destinationId))) {
                        await tx.query(
                            'INSERT INTO journey_stops (id, journey_id, destination_id, stop_order, is_completed) VALUES ($1, $2, $3, $4, 0)',
                            [uuidv4(), journeyId, destinationId, currentStops.length]
                        );
                    }
                }

                const [stops] = await tx.query(
                    `SELECT d.lat, d.lng FROM journey_stops js
                     JOIN destinations d ON d.id = js.destination_id
                     WHERE js.journey_id = $1 ORDER BY js.stop_order`,
                    [journeyId]
                );
                let totalMeters = 0;
                for (let index = 1; index < stops.length; index += 1) {
                    totalMeters += Model.haversine(stops[index - 1].lat, stops[index - 1].lng, stops[index].lat, stops[index].lng);
                }
                const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
                await tx.query(
                    'UPDATE journeys SET total_km = $1, total_minutes = $2 WHERE id = $3',
                    [totalKm, stops.length * 60 + Math.round(totalKm * 15), journeyId]
                );
            });
            res.json({ success: true });
        } catch (error) {
            if (['JOURNEY_NOT_OWNED', 'STOP_NOT_FOUND', 'DESTINATION_UNAVAILABLE', 'JOURNEY_LOCKED'].includes(error.code)) {
                return res.status(error.code === 'JOURNEY_NOT_OWNED' ? 404 : 409).json({ success: false, message: 'Không thể cập nhật hành trình này.' });
            }
            if (['INVALID_STOP_ORDER', 'DESTINATION_REQUIRED'].includes(error.code)) {
                return res.status(400).json({ success: false, message: 'Dữ liệu điểm dừng không hợp lệ.' });
            }
            console.error("Update stop error:", error);
            res.status(500).json({ success: false, message: 'Không thể cập nhật hành trình lúc này.' });
        }
    }

    // --- CHECK-IN API ---
    async checkin(req, res) {
        if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
        
        const body = req.body;
        const sessionUuid = req.cookies?.session_uuid;
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
        const userId = authenticatedUser?.id || null;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'Vui lòng đăng nhập tài khoản để thực hiện quét mã check-in tích điểm!',
                error_type: 'AUTH_REQUIRED',
                login_url: '/auth/login?redirect=' + encodeURIComponent('/checkin' + (slug ? `?slug=${slug}` : ''))
            });
        }
        if (String(session.user_id || '') !== String(userId)) {
            return res.status(403).json({ success: false, message: 'Phiên check-in không thuộc tài khoản hiện tại.' });
        }

        const dest = await Destination.findBySlug(slug);
        if (!dest) {
            return res.status(404).json({ success: false, message: 'Địa điểm không hợp lệ' });
        }

        const distance = Model.haversine(lat, lng, dest.lat, dest.lng);
        const maxRadius = CHECKIN_RADIUS_METERS;
        
        if (distance > maxRadius) {
            return res.status(400).json({ success: false, message: 'Nằm ngoài bán kính địa điểm', error_type: 'OUT_OF_RADIUS' });
        }

        try {
            const checkinClaim = await CheckIn.claimForUser({
                sessionId: session.id,
                userId,
                destinationId: dest.id,
                points: dest.points,
                method,
                lat,
                lng,
                distance: Math.round(distance)
            });
            if (!checkinClaim.claimed) {
                const createdAt = new Date(checkinClaim.recent.created_at).getTime();
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

            const journey = await Journey.getCurrentBySession(session.id);
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

            if (typeof message !== 'string' || !message.trim()) {
                return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
            }
            const normalizedMessage = message.trim();
            if (normalizedMessage.length > 2000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalizedMessage)) {
                return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không hợp lệ hoặc vượt quá 2.000 ký tự.' });
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
                [uuidv4(), currentUserId, session.id, receiverUuid, destinationId || null, normalizedMessage]
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

            if (!isManagerUser(manager)) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }

            if (!replyText || !replyText.trim()) {
                return res.status(400).json({ success: false, message: 'Nội dung phản hồi không được để trống.' });
            }

            const managerIsAdmin = isAdminUser(manager);
            const managerDestinationId = manager.managed_destination_id || null;
            if (!managerIsAdmin && !managerDestinationId) {
                return res.status(403).json({ success: false, message: 'Tài khoản quản lý chưa được gán địa điểm.' });
            }

            let receiverUuid = null;
            let finalDestId = managerIsAdmin ? (destinationId || null) : managerDestinationId;

            if (sessionId) {
                receiverUuid = sessionId;
                if (!managerIsAdmin && destinationId && String(destinationId) !== String(managerDestinationId)) {
                    return res.status(403).json({ success: false, message: 'Không thể phản hồi ngoài địa điểm được phân công.' });
                }
            } else if (messageId) {
                const [rows] = await db.query("SELECT * FROM messages WHERE id = $1", [messageId]);
                if (rows.length === 0) return res.status(404).json({ success: false, message: 'Message not found' });
                const originalMsg = rows[0];
                if (!managerIsAdmin && (!originalMsg.destination_id || String(originalMsg.destination_id) !== String(managerDestinationId))) {
                    return res.status(403).json({ success: false, message: 'Không thể phản hồi hội thoại ngoài địa điểm được phân công.' });
                }
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
            if (!isManagerUser(user)) {
                return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này.' });
            }

            const { session_id, destination_id } = req.body;
            if (!session_id) {
                return res.status(400).json({ success: false, message: 'Thiếu ID hội thoại.' });
            }

            const userIsAdmin = isAdminUser(user);
            const targetDestId = userIsAdmin ? (destination_id || null) : user.managed_destination_id;
            if (!userIsAdmin && !targetDestId) {
                return res.status(403).json({ success: false, message: 'Tài khoản quản lý chưa được gán địa điểm.' });
            }

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
            if (!['all', 'self'].includes(type)) {
                return res.status(400).json({ success: false, message: 'Kiểu thu hồi không hợp lệ.' });
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
                if (isAdminUser(user)) canRecall = true;
                else if (isManagerUser(user) && user?.managed_destination_id && String(msg.destination_id) === String(user.managed_destination_id)) canRecall = true;
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
        let client;
        const { destinationId } = req.body;
        const user = req.user || req.session?.user;

        if (!user) {
            return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thích địa điểm.' });
        }
        if (!destinationId) {
            return res.status(400).json({ success: false, message: 'Thiếu ID địa điểm.' });
        }

        try {
            client = await db.pgPool.connect();
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`like:${user.id}:${destinationId}`]);
            const destination = await client.query('SELECT id FROM destinations WHERE id = $1 AND is_active = 1', [destinationId]);
            if (destination.rowCount !== 1) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Địa điểm không tồn tại hoặc đã ngừng hoạt động.' });
            }
            const rowsResult = await client.query(
                "SELECT id FROM destination_likes WHERE user_id = $1 AND destination_id = $2",
                [user.id, destinationId]
            );
            const rows = rowsResult.rows;

            let liked = false;
            if (rows.length > 0) {
                await client.query(
                    "DELETE FROM destination_likes WHERE user_id = $1 AND destination_id = $2",
                    [user.id, destinationId]
                );
                liked = false;
            } else {
                await client.query(
                    "INSERT INTO destination_likes (id, user_id, destination_id) VALUES ($1, $2, $3)",
                    [uuidv4(), user.id, destinationId]
                );
                liked = true;
            }

            const countResult = await client.query(
                "SELECT COUNT(*) as count FROM destination_likes WHERE destination_id = $1",
                [destinationId]
            );
            const countRows = countResult.rows;
            const likesCount = parseInt(countRows[0]?.count || 0, 10);
            await client.query('COMMIT');
            res.json({ success: true, liked, likesCount });
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error("Like destination error:", error);
            res.status(500).json({ success: false, message: error.message });
        } finally {
            client?.release();
        }
    }

    async save(req, res) {
        let client;
        const { destinationId } = req.body;
        const user = req.user || req.session?.user;

        if (!user) {
            return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để lưu địa điểm.' });
        }
        if (!destinationId) {
            return res.status(400).json({ success: false, message: 'Thiếu ID địa điểm.' });
        }

        try {
            client = await db.pgPool.connect();
            await client.query('BEGIN');
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`favorite:${user.id}:${destinationId}`]);
            const destination = await client.query('SELECT id FROM destinations WHERE id = $1 AND is_active = 1', [destinationId]);
            if (destination.rowCount !== 1) {
                await client.query('ROLLBACK');
                return res.status(404).json({ success: false, message: 'Địa điểm không tồn tại hoặc đã ngừng hoạt động.' });
            }
            const rowsResult = await client.query(
                "SELECT id FROM user_favorites WHERE user_id = $1 AND destination_id = $2",
                [user.id, destinationId]
            );
            const rows = rowsResult.rows;

            let saved = false;
            if (rows.length > 0) {
                await client.query(
                    "DELETE FROM user_favorites WHERE user_id = $1 AND destination_id = $2",
                    [user.id, destinationId]
                );
                saved = false;
            } else {
                await client.query(
                    "INSERT INTO user_favorites (id, user_id, destination_id) VALUES ($1, $2, $3)",
                    [uuidv4(), user.id, destinationId]
                );
                saved = true;
            }

            await client.query('COMMIT');
            res.json({ success: true, saved });
        } catch (error) {
            if (client) await client.query('ROLLBACK').catch(() => {});
            console.error("Save destination error:", error);
            res.status(500).json({ success: false, message: error.message });
        } finally {
            client?.release();
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
