const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Reject browser-originated writes from another origin.  SameSite cookies are
 * retained as the primary cookie policy; this is a server-side defense for
 * fetch/XHR and form POSTs that include an Origin header. Requests without an
 * Origin header are kept compatible with standard navigation forms and
 * non-browser monitoring clients.
 */
module.exports = function sameOrigin(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next();
    try {
        const originHost = new URL(origin).host.toLowerCase();
        const requestHost = String(req.get('host') || '').toLowerCase();
        if (originHost && requestHost && originHost === requestHost) return next();
    } catch (_) {
        // A malformed Origin is never a valid same-origin browser request.
    }
    return res.status(403).json({
        success: false,
        code: 'CROSS_ORIGIN_WRITE_REJECTED',
        message: 'Yêu cầu ghi dữ liệu không hợp lệ.'
    });
};
