/**
 * Analytics Middleware — Track real page views & session duration
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

module.exports = function analyticsMiddleware(req, res, next) {
    // Only track GET requests to pages (not API/static)
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|webp|mp4|webm)$/)) {
        return next();
    }

    const startTime = Date.now();
    const sessionId = req.cookies?.session_uuid || 'anonymous';

    // Track page view on response finish
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const ip = req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';

        db.query(
            `INSERT INTO analytics (id, session_id, event, page_url, user_agent, duration_ms, ip_address, created_at) 
             VALUES (?, ?, 'page_view', ?, ?, ?, ?, NOW())`,
            [uuidv4(), sessionId, req.originalUrl, (req.headers['user-agent'] || '').substring(0, 500), duration, ip]
        ).catch(() => {}); // Silent fail — analytics should never break the app
    });

    next();
};
