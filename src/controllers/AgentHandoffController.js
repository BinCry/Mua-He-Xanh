const { createHash } = require('node:crypto');
const { v4: uuidv4 } = require('uuid');
const { agentConversationUuid, trustedPrincipal } = require('./AgentChatController');
const { createHelpdeskAgentClient } = require('../services/HelpdeskAgentClient');

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
function safeText(value) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email đã ẩn]')
        .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, '[số điện thoại đã ẩn]')
        .replace(/(?:Bearer\s+\S+|(?:password|token|secret|otp|api[_ -]?key)\s*[:=]\s*\S+)/gi, '[thông tin bảo mật đã ẩn]');
}
function summaryFromPacket(packet) {
    // Reserve space for completed actions before verbose conversation history.
    packet = { ...packet, goal: safeText(packet.goal).slice(0, 240),
        previous_goal: safeText(packet.previous_goal).slice(0, 200),
        current_state: safeText(packet.current_state).slice(0, 140) };
    const lines = ['BÀN GIAO TỪ TRỢ LÝ AI', `Yêu cầu: ${safeText(packet.goal)}`];
    for (const item of (packet.side_effects || []).slice(0, 3)) {
        lines.push(`Thao tác đã thực hiện: ${safeText(typeof item === 'string' ? item : item.summary || item.action || item.reference_id).slice(0, 100)}`);
    }
    if (packet.previous_goal && packet.previous_goal !== packet.goal) lines.push(`Vấn đề trước khi bàn giao: ${safeText(packet.previous_goal)}`);
    if (packet.current_state) lines.push(`Ngữ cảnh: ${safeText(packet.current_state)}`);
    for (const booking of (packet.workshop_bookings || []).slice(0, 2)) {
        lines.push(`Booking: ${safeText(booking.booking_id)} — ${safeText(booking.workshop_title)} — ${safeText(booking.status_label || booking.status)}`);
    }
    for (const item of (packet.decisions || []).slice(0, 5)) lines.push(`Đã ghi nhận: ${safeText(item.summary)}`);
    for (const item of (packet.findings || []).slice(0, 5)) lines.push(`Nguồn: ${safeText(item.title)} (${safeText(item.citation_id)}; ${safeText(item.source_id)}${item.locator ? `; ${safeText(item.locator)}` : ''})`);
    for (const item of (packet.failed_attempts || []).slice(0, 3)) lines.push(`Bước chưa thành công: ${safeText(typeof item === 'string' ? item : item.summary || item.reason || item.tool)}`);
    lines.push('Nhân viên vui lòng tiếp nhận và xác nhận bước xử lý tiếp theo.');
    return lines.join('\n').slice(0, 1500);
}
function messageId(handoffId, principalId) {
    const hex = createHash('sha256').update(`handoff:${principalId}:${handoffId}`).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function createAgentHandoffController({ client = createHelpdeskAgentClient(), database, sessions } = {}) {
    const db = () => database || require('../core/database');
    const sessionModel = () => sessions || require('../models/UserSession');
    function failure(res, error) {
        const status = error.code === 'HANDOFF_EXPIRED' ? 410 : error.code === 'HANDOFF_NOT_FOUND' ? 404 : 503;
        return res.status(status).json({ success: false, message: status === 410
            ? 'Yêu cầu bàn giao đã hết hạn. Vui lòng bắt đầu cuộc trò chuyện mới.'
            : 'Chưa thể chuyển ngữ cảnh. Bạn có thể thử lại hoặc nhắn trực tiếp cho nhân viên.' });
    }
    return {
        async preview(req, res) {
            const principal = trustedPrincipal(req, res);
            if (!principal) return;
            let handoffId = req.body?.handoffId;
            if (handoffId && (typeof handoffId !== 'string' || !ID.test(handoffId))) return res.status(400).json({ success: false, message: 'Mã bàn giao không hợp lệ.' });
            const context = { conversationId: `web-${agentConversationUuid(req, res)}`, ...principal, requestId: uuidv4() };
            try {
                if (!handoffId) {
                    const output = await client.chat({ ...context, message: 'Tôi muốn gặp nhân viên hỗ trợ' });
                    if (output.type !== 'handoff' || !ID.test(output.handoffId || '')) return res.status(409).json({ success: false, message: 'Trợ lý chưa tạo được bản bàn giao. Vui lòng thử lại.' });
                    handoffId = output.handoffId;
                }
                const { packet } = await client.handoff({ ...context, handoffId });
                return res.json({ success: true, data: { handoffId, summary: summaryFromPacket(packet) } });
            } catch (error) { return failure(res, error); }
        },
        async send(req, res) {
            const principal = trustedPrincipal(req, res);
            if (!principal) return;
            const { handoffId, note = '', destinationId = null } = req.body || {};
            if (typeof handoffId !== 'string' || !ID.test(handoffId) || typeof note !== 'string' || note.length > 300 || (destinationId !== null && !ID.test(String(destinationId)))) return res.status(400).json({ success: false, message: 'Yêu cầu bàn giao không hợp lệ.' });
            try {
                const { packet } = await client.handoff({ handoffId, conversationId: `web-${agentConversationUuid(req, res)}`, ...principal, requestId: uuidv4() });
                let sessionUuid = req.cookies?.session_uuid;
                if (!sessionUuid) {
                    sessionUuid = uuidv4();
                    res.cookie('session_uuid', sessionUuid, { maxAge: 2592000000, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
                }
                const session = await sessionModel().findOrCreate(sessionUuid, req);
                if (!session || (session.user_id && String(session.user_id) !== principal.principalId)) return res.status(403).json({ success: false, message: 'Phiên trò chuyện không thuộc tài khoản hiện tại.' });
                // Claim/check in the database as well: the model may return a stale
                // cached session or another account may race this request.
                const [owned] = await db().query('UPDATE user_sessions SET user_id = $1 WHERE id = $2 AND (user_id IS NULL OR user_id = $1) RETURNING id', [principal.principalId, session.id]);
                if (!owned.length) return res.status(403).json({ success: false, message: 'Phiên trò chuyện không thuộc tài khoản hiện tại.' });
                let receiver = null;
                if (destinationId) {
                    const [managers] = await db().query("SELECT id FROM users WHERE managed_destination_id = $1 AND role = 'manager' LIMIT 1", [destinationId]);
                    receiver = managers[0]?.id || null;
                }
                const id = messageId(handoffId, principal.principalId);
                const content = `${summaryFromPacket(packet)}${note.trim() ? `\nLời nhắn của khách: ${safeText(note.trim())}` : ''}\nMã bàn giao: ${handoffId}`.slice(0, 2000);
                await db().query('INSERT INTO messages (id, sender_id, sender_uuid, receiver_uuid, destination_id, message, content, created_at) VALUES ($1, $2, $3, $4, $5, $6, $6, NOW()) ON CONFLICT (id) DO NOTHING', [id, principal.principalId, session.id, receiver, destinationId, content]);
                return res.json({ success: true, data: { handoffId, status: 'waiting_for_human', messageId: id } });
            } catch (error) { return failure(res, error); }
        }
    };
}
module.exports = { ...createAgentHandoffController(), createAgentHandoffController, summaryFromPacket };
