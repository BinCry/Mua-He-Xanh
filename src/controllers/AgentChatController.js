const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { AgentServiceError, createHelpdeskAgentClient } = require('../services/HelpdeskAgentClient');
const { createReviewReceipt, readReviewReceipt } = require('../services/AgentReviewReceipt');

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;
const agentClient = createHelpdeskAgentClient();

function isAdmin(user) {
    return user?.role === 'admin' || Number(user?.role_id) === 1;
}

function createAgentChatController({ client = agentClient, env = process.env } = {}) {
    function publicOutput(output, conversationId) {
        // Chỉ phát mã bàn giao đã mã hóa; không đưa conversationId ra response trình duyệt.
        const kind = output?.type === 'approval_pending' ? 'approval' : output?.type === 'handoff' ? 'handoff' : null;
        if (!kind) return output;
        const pauseId = kind === 'approval' ? output.approvalId : output.handoffId;
        const reviewReceipt = createReviewReceipt({
            conversationId, pauseId, kind,
            summary: output.actionPreview?.summary || output.message
        }, env);
        return { ...output, reviewReceipt };
    }

    function serviceFailure(res, error) {
        if (error instanceof AgentServiceError && error.code === 'AGENT_CONVERSATION_PAUSED') {
            return res.status(409).json({ success: false, message: 'Hội thoại AI đang chờ nhân viên xử lý.' });
        }
        if (error instanceof AgentServiceError && error.code === 'AGENT_PAUSE_CONFLICT') {
            return res.status(409).json({ success: false, message: 'Yêu cầu đã thay đổi hoặc đã được xử lý. Hãy kiểm tra lại với khách.' });
        }
        if (error instanceof AgentServiceError && error.code === 'AGENT_FORBIDDEN') {
            return res.status(403).json({ success: false, message: 'Không có quyền xử lý hội thoại này.' });
        }
        if (error instanceof AgentServiceError && ['AGENT_NOT_FOUND', 'AGENT_RECEIPT_EXPIRED'].includes(error.code)) {
            return res.status(error.code === 'AGENT_NOT_FOUND' ? 404 : 410).json({
                success: false, message: 'Yêu cầu không còn khả dụng. Hãy kiểm tra lại với khách.'
            });
        }
        return res.status(503).json({ success: false, message: 'Trợ lý AI tạm thời không khả dụng. Hãy thử lại sau.' });
    }

    return {
        async chat(req, res) {
            const user = req.user || req.session?.user || null;
            if (!user?.id) {
                return res.status(401).json({
                    success: false,
                    message: 'Vui lòng đăng nhập để sử dụng Trợ lý AI.'
                });
            }

            const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
            if (
                !message ||
                message.length > MAX_MESSAGE_LENGTH ||
                /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Câu hỏi không hợp lệ hoặc vượt quá 2.000 ký tự.'
                });
            }

            const principalId = String(user.id);
            if (!IDENTIFIER_PATTERN.test(principalId)) {
                return res.status(401).json({
                    success: false,
                    message: 'Không thể xác thực phiên đăng nhập hiện tại.'
                });
            }

            let sessionUuid = req.cookies?.session_uuid;
            if (!SESSION_UUID_PATTERN.test(String(sessionUuid || ''))) {
                sessionUuid = uuidv4();
                res.cookie('session_uuid', sessionUuid, {
                    maxAge: 30 * 24 * 60 * 60 * 1000,
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: process.env.NODE_ENV === 'production'
                });
            }

            try {
                const conversationId = `web-${sessionUuid}`;
                const output = await client.chat({
                    message,
                    conversationId,
                    principalId,
                    principalRole: isAdmin(user) ? 'admin' : 'customer',
                    requestId: uuidv4()
                });

                // Chỉ trả kết quả công khai; ID phiên và thông tin xác thực ở lại server.
                return res.json({ success: true, data: { output: publicOutput(output, conversationId) } });
            } catch (error) {
                if (error instanceof AgentServiceError && error.code === 'AGENT_CONVERSATION_PAUSED') {
                    return res.status(409).json({
                        success: false,
                        message: 'Hội thoại AI đang chờ nhân viên xử lý. Bạn có thể chuyển sang chat nhân viên.'
                    });
                }
                return res.status(503).json({
                    success: false,
                    message: 'Trợ lý AI tạm thời không khả dụng. Hãy thử lại hoặc chuyển sang hỗ trợ nhân viên.'
                });
            }
        },
        async clear(req, res) {
            const user = req.user || req.session?.user;
            const sessionUuid = String(req.cookies?.session_uuid || '');
            if (req.body?.confirm !== 'clear') {
                return res.status(400).json({ success: false, message: 'Cần xác nhận trước khi xóa hội thoại AI.' });
            }
            if (!user?.id || !IDENTIFIER_PATTERN.test(String(user.id))) {
                return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập lại.' });
            }
            if (!SESSION_UUID_PATTERN.test(sessionUuid)) return res.json({ success: true, data: { cleared: false } });
            try {
                const cleared = await client.clear({
                    conversationId: `web-${sessionUuid}`,
                    principalId: String(user.id),
                    principalRole: isAdmin(user) ? 'admin' : 'customer',
                    requestId: uuidv4()
                });
                return res.json({ success: true, data: { cleared } });
            } catch (error) {
                return serviceFailure(res, error);
            }
        },
        reviewPage(req, res) {
            return res.render('admin/agent-review', {
                title: 'Duyệt yêu cầu Trợ lý AI', layout: 'layouts/admin', adminPage: 'agent-review'
            });
        },
        inspectReview(req, res) {
            const receipt = readReviewReceipt(req.body?.receipt, env);
            if (!receipt) return res.status(400).json({ success: false, message: 'Mã bàn giao không hợp lệ hoặc đã hết hạn.' });
            return res.json({ success: true, data: { kind: receipt.kind, summary: receipt.summary } });
        },
        async resume(req, res) {
            const user = req.user || req.session?.user;
            if (!isAdmin(user) || !IDENTIFIER_PATTERN.test(String(user?.id || ''))) {
                return res.status(403).json({ success: false, message: 'Chỉ quản trị viên được xử lý yêu cầu này.' });
            }
            const receipt = readReviewReceipt(req.body?.receipt, env);
            const decision = req.body?.decision;
            const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
            if (!receipt || !['approve', 'reject'].includes(decision) || note.length > 2000) {
                return res.status(400).json({ success: false, message: 'Yêu cầu duyệt không hợp lệ hoặc đã hết hạn.' });
            }
            // Cùng admin và quyết định luôn dùng lại một khóa khi retry sau timeout.
            const idempotencyKey = crypto.createHmac('sha256', String(env.SESSION_SECRET))
                .update(`${receipt.conversationId}\0${receipt.pauseId}\0${decision}\0${user.id}`)
                .digest('hex');
            try {
                const output = await client.resume({
                    conversationId: receipt.conversationId,
                    pauseId: receipt.pauseId,
                    decision, note, idempotencyKey,
                    principalId: String(user.id), requestId: uuidv4()
                });
                return res.json({ success: true, data: { output: publicOutput(output, receipt.conversationId) } });
            } catch (error) {
                return serviceFailure(res, error);
            }
        }
    };
}

module.exports = {
    ...createAgentChatController(),
    createAgentChatController
};
