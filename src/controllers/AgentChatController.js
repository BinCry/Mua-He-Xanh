const { v4: uuidv4 } = require('uuid');
const { createHelpdeskAgentClient } = require('../services/HelpdeskAgentClient');

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 2000;
const agentClient = createHelpdeskAgentClient();

function isAdmin(user) {
    return user?.role === 'admin' || Number(user?.role_id) === 1;
}

function createAgentChatController({ client = agentClient } = {}) {
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
                const output = await client.chat({
                    message,
                    conversationId: `web-${sessionUuid}`,
                    principalId,
                    principalRole: isAdmin(user) ? 'admin' : 'customer',
                    requestId: uuidv4()
                });

                // Chỉ trả kết quả công khai; ID phiên và thông tin xác thực ở lại server.
                return res.json({ success: true, data: { output } });
            } catch (_) {
                return res.status(503).json({
                    success: false,
                    message: 'Trợ lý AI tạm thời không khả dụng. Hãy thử lại hoặc chuyển sang hỗ trợ nhân viên.'
                });
            }
        }
    };
}

module.exports = {
    ...createAgentChatController(),
    createAgentChatController
};
