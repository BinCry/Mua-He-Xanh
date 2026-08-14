/**
 * Analytics Middleware - Pure PostgreSQL
 * Optimized for Vercel Edge CDN: Does NOT mutate req.session on GET requests,
 * allowing Vercel CDN to cache HTML & static assets without Set-Cookie bypass.
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

const pageViewCache = new Map();

module.exports = function analyticsMiddleware(req, res, next) {
    // Only track GET requests to pages (not API/static)
    if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|webp|mp4|webm)$/)) {
        return next();
    }

    const startTime = Date.now();
    const sessionId = req.cookies?.session_uuid || 'anonymous';
    const pageUrl = req.originalUrl;
    const cacheKey = `${sessionId}:${pageUrl}`;

    const lastVisited = pageViewCache.get(cacheKey);
    const THROTTLE_LIMIT = 3000; // 3 seconds anti-spam throttle for real-time tracking

    let shouldLog = true;
    if (lastVisited && (startTime - lastVisited < THROTTLE_LIMIT)) {
        shouldLog = false;
    } else {
        pageViewCache.set(cacheKey, startTime);
        if (pageViewCache.size > 5000) {
            pageViewCache.clear();
        }
    }

    res.on('finish', () => {
        if (!shouldLog) return;
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
