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
        IDEMPOTENCY_PAYLOAD_CONFLICT: 409,
        IDEMPOTENCY_IN_PROGRESS: 409,
        INVALID_STATUS_TRANSITION: 409,
        COMMERCE_STATE_CONFLICT: 409,
        INSUFFICIENT_STOCK: 409,
        INSUFFICIENT_WORKSHOP_SEATS: 409,
        WORKSHOP_SESSION_ALREADY_STARTED: 409,
        WORKSHOP_SESSION_NOT_FINISHED: 409,
        COMMERCE_RESERVATION_INCONSISTENT: 409,
        IDEMPOTENCY_KEY_REQUIRED: 400,
        INVALID_QUANTITY: 400,
        INVALID_SEAT_COUNT: 400
    })[code] || 500;
    if (status === 500) console.error('Commerce operation error:', error);
    return res.status(status).json({ success: false, code, message: 'Không thể hoàn tất thao tác. Vui lòng kiểm tra lại dữ liệu và thử lại.' });
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
                userId: currentUser(req)?.id,
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
