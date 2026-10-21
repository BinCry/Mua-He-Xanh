const ProductOrderService = require('../services/ProductOrderService');
const WorkshopBookingService = require('../services/WorkshopBookingService');
const CommerceTransitionService = require('../services/CommerceTransitionService');

function currentUser(req) {
    return req.user || req.session?.user || null;
}

function idempotencyKey(req) {
    return req.get('Idempotency-Key') || req.body?.idempotencyKey;
}

function errorResponse(res, error) {
    const code = error?.code || 'COMMERCE_OPERATION_FAILED';
    const status = ({
        AUTHENTICATION_REQUIRED: 401,
        COMMERCE_RECORD_FORBIDDEN: 403,
        COMMERCE_RECORD_NOT_FOUND: 404,
        PRODUCT_UNAVAILABLE: 404,
        WORKSHOP_SESSION_UNAVAILABLE: 404,
        WORKSHOP_BOOKING_FORBIDDEN: 403,
        WORKSHOP_ALREADY_BOOKED: 409,
        IDEMPOTENCY_PAYLOAD_CONFLICT: 409,
        IDEMPOTENCY_IN_PROGRESS: 409,
        INVALID_STATUS_TRANSITION: 409,
        COMMERCE_STATE_CONFLICT: 409,
        INSUFFICIENT_STOCK: 409,
        INSUFFICIENT_WORKSHOP_SEATS: 409,
        WORKSHOP_SESSION_ALREADY_STARTED: 409,
        WORKSHOP_SESSION_NOT_FINISHED: 409,
        WORKSHOP_CANCELLATION_CLOSED: 409,
        COMMERCE_RESERVATION_INCONSISTENT: 409,
        IDEMPOTENCY_KEY_REQUIRED: 400,
        INVALID_QUANTITY: 400,
        INVALID_SEAT_COUNT: 400
    })[code] || 500;
    if (status === 500) console.error('Commerce operation error:', error);
    const message = ({
        AUTHENTICATION_REQUIRED: 'Vui lòng đăng nhập để thực hiện thao tác này.',
        COMMERCE_RECORD_FORBIDDEN: 'Bạn không có quyền thay đổi booking này.',
        COMMERCE_RECORD_NOT_FOUND: 'Không tìm thấy booking Workshop.',
        WORKSHOP_SESSION_UNAVAILABLE: 'Ca Workshop không còn mở đăng ký.',
        WORKSHOP_BOOKING_FORBIDDEN: 'Chỉ tài khoản du khách mới có thể đăng ký Workshop.',
        WORKSHOP_ALREADY_BOOKED: 'Bạn đã có booking đang hoạt động cho ca Workshop này.',
        INVALID_STATUS_TRANSITION: 'Không thể chuyển booking sang trạng thái đã chọn.',
        INSUFFICIENT_WORKSHOP_SEATS: 'Ca Workshop không còn đủ chỗ.',
        WORKSHOP_SESSION_ALREADY_STARTED: 'Ca Workshop đã bắt đầu nên không thể đăng ký.',
        WORKSHOP_SESSION_NOT_FINISHED: 'Chỉ có thể hoàn thành booking sau khi ca kết thúc.',
        WORKSHOP_CANCELLATION_CLOSED: 'Bạn không thể tự hủy booking sau khi ca đã bắt đầu. Vui lòng liên hệ quản lý.',
        IDEMPOTENCY_KEY_REQUIRED: 'Yêu cầu không hợp lệ. Vui lòng tải lại trang và thử lại.',
        INVALID_SEAT_COUNT: 'Số chỗ đăng ký không hợp lệ.'
    })[code] || 'Không thể hoàn tất thao tác. Vui lòng kiểm tra lại dữ liệu và thử lại.';
    return res.status(status).json({ success: false, code, message });
}

class CommerceController {
    async shopOrdersRetired(req, res) {
        return res.status(410).json({
            success: false,
            code: 'SHOP_CONTACT_ONLY',
            message: 'Shop chỉ hỗ trợ liên hệ trực tiếp; hệ thống không nhận đơn hàng trực tuyến.'
        });
    }

    async createProductOrder(req, res) {
        try {
            const result = await ProductOrderService.create({
                userId: currentUser(req)?.id,
                productId: req.body?.productId,
                quantity: Number(req.body?.quantity),
                idempotencyKey: idempotencyKey(req)
            });
            return res.status(result.replay ? 200 : 201).json(result);
        } catch (error) {
            return errorResponse(res, error);
        }
    }

    async createWorkshopBooking(req, res) {
        try {
            const result = await WorkshopBookingService.create({
                actor: currentUser(req),
                sessionId: req.body?.sessionId,
                seats: Number(req.body?.seats),
                idempotencyKey: idempotencyKey(req)
            });
            return res.status(result.replay ? 200 : 201).json(result);
        } catch (error) {
            return errorResponse(res, error);
        }
    }

    async transitionProductOrder(req, res) {
        try {
            const result = await CommerceTransitionService.transitionProduct({
                actor: currentUser(req),
                orderId: req.params.id,
                targetStatus: req.body?.status,
                idempotencyKey: idempotencyKey(req)
            });
            return res.status(200).json(result);
        } catch (error) {
            return errorResponse(res, error);
        }
    }

    async transitionWorkshopBooking(req, res) {
        try {
            const result = await CommerceTransitionService.transitionWorkshop({
                actor: currentUser(req),
                bookingId: req.params.id,
                targetStatus: req.body?.status,
                idempotencyKey: idempotencyKey(req)
            });
            return res.status(200).json(result);
        } catch (error) {
            return errorResponse(res, error);
        }
    }
}

module.exports = new CommerceController();
