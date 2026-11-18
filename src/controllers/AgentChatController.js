const { v4: uuidv4 } = require('uuid');
const { createHelpdeskAgentClient } = require('../services/HelpdeskAgentClient');

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;
const AGENT_CONVERSATION_COOKIE = 'agent_conversation_id';
const agentClient = createHelpdeskAgentClient();

function isAdmin(user) {
    return user?.role === 'admin' || Number(user?.role_id) === 1;
}

function setAgentConversationCookie(res, value) {
    res.cookie(AGENT_CONVERSATION_COOKIE, value, {
        maxAge: 30 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production'
    });
}

function agentConversationUuid(req, res, { rotate = false } = {}) {
    const current = String(req.cookies?.[AGENT_CONVERSATION_COOKIE] || '');
    const legacy = String(req.cookies?.session_uuid || '');
    const value = !rotate && SESSION_UUID_PATTERN.test(current)
        ? current
        : !rotate && SESSION_UUID_PATTERN.test(legacy)
            ? legacy
            : uuidv4();
    if (rotate || current !== value) setAgentConversationCookie(res, value);
    return value;
}

function currentUser(req) {
    return req.user || req.session?.user || null;
}

function trustedPrincipal(req, res) {
    const user = currentUser(req);
    if (!user?.id) {
        res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để sử dụng Trợ lý AI.' });
        return null;
    }
    const principalId = String(user.id);
    if (!IDENTIFIER_PATTERN.test(principalId)) {
        res.status(401).json({ success: false, message: 'Không thể xác thực phiên đăng nhập hiện tại.' });
        return null;
    }
    return {
        principalId,
        principalRole: isAdmin(user) ? 'admin' : 'customer'
    };
}

function createAgentChatController({ client = agentClient } = {}) {
    return {
        async chat(req, res) {
            const principal = trustedPrincipal(req, res);
            if (!principal) return;

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

            const conversationUuid = agentConversationUuid(req, res);
            const suppliedRequestId = typeof req.body?.requestId === 'string'
                ? req.body.requestId.trim()
                : '';
            if (suppliedRequestId && !IDENTIFIER_PATTERN.test(suppliedRequestId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Mã yêu cầu không hợp lệ.'
                });
            }

            try {
                const output = await client.chat({
                    message,
                    conversationId: `web-${conversationUuid}`,
                    ...principal,
                    requestId: suppliedRequestId || uuidv4()
                });

                // Chỉ trả kết quả công khai; ID phiên và thông tin xác thực ở lại server.
                return res.json({ success: true, data: { output } });
            } catch (_) {
                return res.status(503).json({
                    success: false,
                    message: 'Trợ lý AI tạm thời không khả dụng. Hãy thử lại hoặc chuyển sang hỗ trợ nhân viên.'
                });
            }
        },

        async history(req, res) {
            const principal = trustedPrincipal(req, res);
            if (!principal) return;
            const conversationUuid = agentConversationUuid(req, res);
            try {
                const history = await client.history({
                    conversationId: `web-${conversationUuid}`,
                    ...principal,
                    requestId: uuidv4(),
                    limit: 100
                });
                return res.json({ success: true, data: history });
            } catch (_) {
                return res.status(503).json({
                    success: false,
                    message: 'Chưa thể tải lại lịch sử Trợ lý AI.'
                });
            }
        },

        async startConversation(req, res) {
            const principal = trustedPrincipal(req, res);
            if (!principal) return;
            agentConversationUuid(req, res, { rotate: true });
            return res.status(201).json({
                success: true,
                data: { messages: [], nextCursor: null }
            });
        }
    };
}

module.exports = {
    ...createAgentChatController(),
    createAgentChatController,
    AGENT_CONVERSATION_COOKIE
};
