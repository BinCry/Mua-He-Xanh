/**
 * Controllers should return purposeful domain errors for 4xx responses. Any
 * unexpected 5xx response must never disclose database, provider or stack
 * details, including from older controllers that still interpolate Error.message.
 */
module.exports = function sanitizeServerErrors(req, res, next) {
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    res.json = function safeJson(payload) {
        if (res.statusCode >= 500) {
            const safe = { success: false, message: 'Lỗi hệ thống. Vui lòng thử lại sau.' };
            return originalJson(safe);
        }
        return originalJson(payload);
    };

    res.send = function safeSend(payload) {
        if (res.statusCode >= 500) {
            res.type('text/plain; charset=utf-8');
            return originalSend('Lỗi hệ thống. Vui lòng thử lại sau.');
        }
        return originalSend(payload);
    };

    return next();
};
