const { AgentWorkshopBookingQueryService } = require('../services/AgentWorkshopBookingQueryService');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function header(req, name) {
    return req.get?.(name) || req.headers?.[name.toLowerCase()];
}

function createAgentWorkshopBookingController({ queryService = AgentWorkshopBookingQueryService } = {}) {
    return {
        async list(req, res, next) {
            const principalId = String(header(req, 'X-Principal-ID') || '').trim();
            const requestId = String(header(req, 'X-Request-ID') || '').trim();
            if (!REQUEST_ID_PATTERN.test(requestId)) {
                return res.status(400).json({
                    success: false,
                    code: 'INVALID_REQUEST_ID',
                    message: 'X-Request-ID is invalid.'
                });
            }

            try {
                const bookings = await queryService.listForPrincipal({
                    principalId,
                    bookingReference: req.query?.bookingReference,
                    limit: req.query?.limit,
                    offset: req.query?.offset
                });
                res.setHeader('Cache-Control', 'private, no-store');
                return res.status(200).json({
                    success: true,
                    requestId,
                    data: { bookings }
                });
            } catch (error) {
                if (['INVALID_PRINCIPAL_ID', 'INVALID_BOOKING_REFERENCE', 'INVALID_LIMIT', 'INVALID_OFFSET'].includes(error.code)) {
                    return res.status(400).json({
                        success: false,
                        code: error.code,
                        message: 'Invalid request parameters.'
                    });
                }
                return next(error);
            }
        }
    };
}

module.exports = {
    REQUEST_ID_PATTERN,
    createAgentWorkshopBookingController,
    AgentWorkshopBookingController: createAgentWorkshopBookingController()
};
