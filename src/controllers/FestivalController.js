const Festival = require('../models/Festival');
const cache = require('../core/cache');
const FestivalTicketService = require('../services/FestivalTicketService');

function statusForError(error) {
    const code = error?.code || 'FESTIVAL_TICKET_FAILED';
    const status = ({
        AUTHENTICATION_REQUIRED: 401,
        FESTIVAL_UNAVAILABLE: 404,
        INVALID_TICKET_COUNT: 400,
        IDEMPOTENCY_KEY_REQUIRED: 400,
        IDEMPOTENCY_PAYLOAD_CONFLICT: 409,
        IDEMPOTENCY_IN_PROGRESS: 409,
        FESTIVAL_TICKET_NOT_FOUND: 404,
        FESTIVAL_TICKET_FORBIDDEN: 403,
        FESTIVAL_TICKET_STATE_CONFLICT: 409
        ,FESTIVAL_CAPACITY_FULL: 409
        ,FESTIVAL_REGISTRATION_CLOSED: 409
    })[code] || 500;
    return { code, status };
}

class FestivalController {
    async index(req, res) {
        try {
            let festivals = cache.get('festivals:list');
            if (!festivals) {
                festivals = await Festival.findAll();
                cache.set('festivals:list', festivals, 300);
            }
            res.render('festivals/index', {
                title: 'Lễ hội & Sự kiện Bình Lợi',
                festivals: festivals
            });
        } catch (error) {
            console.error("Festival index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    async book(req, res) {
        try {
            const { festivalId, fullName, phone, tickets } = req.body;
            const user = req.user || req.session?.user;
            const ticketCount = Number(tickets);
            if (!user?.id) {
                return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để đăng ký lễ hội.' });
            }
            if (!festivalId || !String(fullName || '').trim() || !/^[0-9+ -]{8,20}$/.test(String(phone || '')) ||
                !Number.isSafeInteger(ticketCount) || ticketCount < 1 || ticketCount > 10) {
                return res.status(400).json({ success: false, message: 'Thông tin đăng ký không hợp lệ.' });
            }
            const result = await FestivalTicketService.create({
                userId: user.id,
                festivalId,
                count: ticketCount,
                idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotencyKey
            });
            res.status(result.replay ? 200 : 201).json({
                ...result,
                message: 'Đăng ký thành công. Vé điện tử đã được lưu vào Passport của bạn.'
            });
        } catch (error) {
            console.error("Booking error:", error);
            const mapped = statusForError(error);
            res.status(mapped.status).json({
                success: false,
                code: mapped.code,
                message: mapped.status === 500 ? 'Không thể đăng ký lễ hội lúc này.' : 'Không thể hoàn tất đăng ký với dữ liệu hiện tại.'
            });
        }
    }

    async cancelTicket(req, res) {
        try {
            const result = await FestivalTicketService.cancel({
                userId: (req.user || req.session?.user)?.id,
                ticketId: req.params.id,
                idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotencyKey
            });
            return res.status(200).json(result);
        } catch (error) {
            const mapped = statusForError(error);
            return res.status(mapped.status).json({
                success: false, code: mapped.code, message: 'Không thể hủy vé với trạng thái hiện tại.'
            });
        }
    }

    async useTicket(req, res) {
        try {
            const result = await FestivalTicketService.use({
                actor: req.user || req.session?.user,
                ticketId: req.params.id,
                idempotencyKey: req.get('Idempotency-Key') || req.body?.idempotencyKey
            });
            return res.status(200).json(result);
        } catch (error) {
            const mapped = statusForError(error);
            return res.status(mapped.status).json({
                success: false, code: mapped.code, message: 'Không thể xác nhận sử dụng vé.'
            });
        }
    }
}

module.exports = new FestivalController();
