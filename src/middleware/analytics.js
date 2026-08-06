/**
 * Analytics Middleware - Pure PostgreSQL
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
    const pageUrl = req.originalUrl;

    let shouldLogPageView = true;
    if (req.session) {
        req.session.visitedPages = req.session.visitedPages || {};
        const lastVisited = req.session.visitedPages[pageUrl];
        const THROTTLE_LIMIT = 15 * 60 * 1000;

        if (lastVisited && (startTime - lastVisited < THROTTLE_LIMIT)) {
            shouldLogPageView = false;
        }
        req.session.visitedPages[pageUrl] = startTime;
    }

    res.on('finish', () => {
        if (!shouldLogPageView) return;

        const duration = Date.now() - startTime;
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';

        db.query(
            `INSERT INTO analytics (id, session_id, event, page_url, user_agent, duration_ms, ip_address, created_at) 
             VALUES ($1, $2, 'page_view', $3, $4, $5, $6, NOW())`,
            [uuidv4(), sessionId, pageUrl, (req.headers['user-agent'] || '').substring(0, 500), duration, ip]
        ).catch(() => {});
    });

    next();
};
