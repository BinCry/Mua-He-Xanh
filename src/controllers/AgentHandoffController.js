const { createHash } = require('node:crypto');
const { v4: uuidv4 } = require('uuid');
const { agentConversationUuid, trustedPrincipal } = require('./AgentChatController');
const { createHelpdeskAgentClient } = require('../services/HelpdeskAgentClient');

const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const PREVIEW_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const HANDOFF_SEND_LABEL = 'Gửi cho nhân viên';
const PREVIEW_REQUEST = 'Tôi muốn gặp nhân viên hỗ trợ';
function safeText(value) {
    return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ')
        .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email đã ẩn]')
        .replace(/(?:\+?\d[\d ().-]{7,}\d)/g, '[số điện thoại đã ẩn]')
        .replace(/(?:Bearer\s+\S+|(?:password|token|secret|otp|api[_ -]?key)\s*[:=]\s*\S+)/gi, '[thông tin bảo mật đã ẩn]');
}
function messageId(previewId, principalId) {
    const hex = createHash('sha256').update(`handoff:${principalId}:${previewId}`).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
function customerPreview(packet) {
    const preview = packet?.customer_preview;
    if (!preview || typeof preview.preview_id !== 'string' || !PREVIEW_ID.test(preview.preview_id)) return null;
    if (typeof preview.summary !== 'string' || !preview.summary.trim()) return null;
    return preview;
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
    async function recover(handoffId, packet, principal, context) {
        // The agent summary is the initial draft. The owning customer may edit
        // that draft before send; the server bounds and redacts the final text.
        const preview = customerPreview(packet);
        if (!preview) throw Object.assign(new Error('missing customer preview'), { code: 'AGENT_RESPONSE_INVALID' });
        const id = messageId(preview.preview_id, principal.principalId);
        const [rows] = await db().query(
            'SELECT id, message FROM messages WHERE id = $1 AND sender_id = $2 LIMIT 1',
            [id, principal.principalId]
        );
        const written = Array.isArray(rows) && rows.length > 0;
        const base = {
            handoffId,
            previewId: preview.preview_id,
            summary: written && typeof rows[0]?.message === 'string'
                ? rows[0].message.replace(/\nMã bàn giao: [^\n]+$/, '')
                : preview.summary,
            sendLabel: HANDOFF_SEND_LABEL
        };
        if (preview.delivery === 'sent') return { ...base, status: 'sent', messageId: id };
        if (written) {
            try {
                await client.acknowledgeHandoff({ ...context, handoffId });
                return { ...base, status: 'sent', messageId: id };
            } catch (_) {
                // The live chat already holds the message; a later retry can
                // finish the delivery acknowledgement without writing twice.
                return { ...base, status: 'pending', written: true, messageId: id };
            }
        }
        return { ...base, status: 'pending', written: false };
    }
    return {
        async preview(req, res) {
            const principal = trustedPrincipal(req, res);
            if (!principal) return;
            const handoffId = req.body?.handoffId;
            if (handoffId !== undefined && (typeof handoffId !== 'string' || !ID.test(handoffId))) return res.status(400).json({ success: false, message: 'Mã bàn giao không hợp lệ.' });
            const context = { conversationId: `web-${agentConversationUuid(req, res)}`, ...principal, requestId: uuidv4() };
            try {
                if (handoffId) {
                    const { packet } = await client.handoff({ ...context, handoffId });
                    return res.json({ success: true, data: await recover(handoffId, packet, principal, context) });
                }
                let output;
                try {
                    output = await client.chat({ ...context, message: PREVIEW_REQUEST });
                } catch (error) {
                    if (error.code !== 'AGENT_CONVERSATION_PAUSED') throw error;
                    const pending = await client.pendingHandoff({ ...context });
                    return res.json({ success: true, data: await recover(pending.handoffId, pending.packet, principal, context) });
                }
                if (output.type === 'handoff') {
                    // Older agent builds answer the request with a ready pause.
                    if (!ID.test(output.handoffId || '')) return res.status(409).json({ success: false, message: 'Trợ lý chưa tạo được bản bàn giao. Vui lòng thử lại.' });
                    const { packet } = await client.handoff({ ...context, handoffId: output.handoffId });
                    return res.json({ success: true, data: await recover(output.handoffId, packet, principal, context) });
                }
                if (output.type === 'clarification_required') {
                    const fields = Array.isArray(output.missingFields) ? output.missingFields : [];
                    if (!fields.includes('handoff_confirmation') || !PREVIEW_ID.test(String(output.previewId || ''))
                        || typeof output.summary !== 'string' || !output.summary.trim()) {
                        return res.status(409).json({ success: false, message: 'Trợ lý chưa tạo được bản bàn giao. Vui lòng thử lại.' });
                    }
                    return res.json({ success: true, data: {
                        status: 'preview',
                        previewId: output.previewId,
                        summary: output.summary,
                        sendLabel: HANDOFF_SEND_LABEL
                    } });
                }
                return res.status(409).json({ success: false, message: 'Trợ lý chưa tạo được bản bàn giao. Vui lòng thử lại.' });
            } catch (error) { return failure(res, error); }
        },
        async send(req, res) {
            const principal = trustedPrincipal(req, res);
            if (!principal) return;
            const { previewId = null, summary = '', destinationId = null } = req.body || {};
            if ((typeof previewId !== 'string' || !PREVIEW_ID.test(previewId))
                || typeof summary !== 'string' || !summary.trim() || summary.length > 1400
                || (destinationId !== null && !ID.test(String(destinationId)))) return res.status(400).json({ success: false, message: 'Yêu cầu bàn giao không hợp lệ.' });
            const reviewedSummary = safeText(summary).trim().slice(0, 1400);
            if (!reviewedSummary) return res.status(400).json({ success: false, message: 'Yêu cầu bàn giao không hợp lệ.' });
            const context = {
                conversationId: `web-${agentConversationUuid(req, res)}`, ...principal,
                // The key is derived from the reviewed preview, so reopening the
                // panel or retrying after a timeout replays the same send.
                requestId: `handoff-send:${previewId}`
            };
            try {
                let handoffId = null;
                let packet = null;
                try {
                    const output = await client.chat({ ...context, message: HANDOFF_SEND_LABEL, handoffPreviewId: previewId });
                    if (output.type === 'handoff' && ID.test(output.handoffId || '')) {
                        handoffId = output.handoffId;
                    } else if (output.type === 'clarification_required') {
                        // The incident changed or the review expired: show the
                        // new summary instead of sending stale content.
                        const changed = PREVIEW_ID.test(String(output.previewId || ''))
                            && typeof output.summary === 'string' && output.summary.trim();
                        return res.json({ success: true, data: changed
                            ? { status: 'preview', previewId: output.previewId, summary: output.summary, sendLabel: HANDOFF_SEND_LABEL,
                                message: 'Nội dung bản tóm tắt đã thay đổi. Vui lòng xem lại trước khi gửi.' }
                            : { status: 'preview', previewId: null, summary: '', sendLabel: HANDOFF_SEND_LABEL } });
                    } else {
                        return res.status(409).json({ success: false, message: 'Trợ lý chưa tạo được bản bàn giao. Vui lòng thử lại.' });
                    }
                } catch (error) {
                    if (error.code !== 'AGENT_CONVERSATION_PAUSED') throw error;
                    // The agent already paused for this handoff on an earlier
                    // attempt; recover its identity rather than creating another.
                    const pending = await client.pendingHandoff({ ...context });
                    handoffId = pending.handoffId;
                    packet = pending.packet;
                }
                if (!packet) packet = (await client.handoff({ ...context, handoffId })).packet;
                const preview = customerPreview(packet);
                if (!preview || preview.preview_id !== previewId) {
                    // A different review is current; the customer must confirm it.
                    return res.json({ success: true, data: {
                        status: 'preview',
                        previewId: preview?.preview_id || null,
                        summary: preview?.summary || '',
                        sendLabel: HANDOFF_SEND_LABEL,
                        message: 'Nội dung bản tóm tắt đã thay đổi. Vui lòng xem lại trước khi gửi.'
                    } });
                }
                const id = messageId(preview.preview_id, principal.principalId);
                if (preview.delivery === 'sent') {
                    return res.json({ success: true, data: { status: 'sent', handoffId, previewId, summary: preview.summary, sendLabel: HANDOFF_SEND_LABEL, messageId: id } });
                }
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
                // The customer reviews one editable message. Re-redact it at
                // the trusted boundary before storing it for staff.
                const lines = [reviewedSummary];
                lines.push(`Mã bàn giao: ${handoffId}`);
                const content = lines.join('\n').slice(0, 2000);
                await db().query('INSERT INTO messages (id, sender_id, sender_uuid, receiver_uuid, destination_id, message, content, created_at) VALUES ($1, $2, $3, $4, $5, $6, $6, NOW()) ON CONFLICT (id) DO NOTHING', [id, principal.principalId, session.id, receiver, destinationId, content]);
                // The agent marks the handoff delivered only after the live chat
                // stored the message. A retry after a timeout is safe: the insert
                // deduplicates and the acknowledgement is idempotent.
                await client.acknowledgeHandoff({ ...context, handoffId });
                return res.json({ success: true, data: {
                    status: 'waiting_for_human', handoffId, previewId,
                    summary: reviewedSummary, messageId: id
                } });
            } catch (error) { return failure(res, error); }
        }
    };
}
module.exports = { ...createAgentHandoffController(), createAgentHandoffController };
