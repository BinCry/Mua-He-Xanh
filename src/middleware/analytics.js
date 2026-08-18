/**
 * Analytics Middleware - Pure PostgreSQL
 * Implements 30-Minute Rolling Session Window (Google Analytics standard)
 * & Real-Time Engagement Time on Site tracking
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

const pageViewCache = new Map();
const sessionActivityCache = new Map();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes window

module.exports = function analyticsMiddleware(req, res, next) {
    // Only track GET requests to actual HTML pages (skip API, manifest, sw, static assets)
    if (
        req.method !== 'GET' || 
        req.path.startsWith('/api/') || 
        req.path === '/manifest.json' || 
        req.path === '/sw.js' || 
        req.path === '/offline.html' || 
        req.path === '/favicon.ico' || 
        req.path === '/robots.txt' || 
        req.path === '/sitemap.xml' || 
        req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|webp|mp4|webm|json)$/)
    ) {
        return next();
    }

    const now = Date.now();
    const sessionId = req.cookies?.session_uuid || req.ip || 'anonymous';
    const pageUrl = req.originalUrl;
    const cacheKey = `${sessionId}:${pageUrl}`;

    // 1. Check if this is a NEW 30-minute session / visit
    const lastSessionActivity = sessionActivityCache.get(sessionId);
    let isNewSession = false;

    if (!lastSessionActivity || (now - lastSessionActivity > SESSION_TIMEOUT_MS)) {
        isNewSession = true;
    }
    sessionActivityCache.set(sessionId, now);

    // Keep session cache bounded in memory
    if (sessionActivityCache.size > 10000) {
        sessionActivityCache.clear();
    }

    // 2. Anti-spam throttle for page views (3s throttle per identical page URL)
    const lastVisitedPage = pageViewCache.get(cacheKey);
    const THROTTLE_LIMIT = 3000;

    let shouldLogPageView = true;
    if (lastVisitedPage && (now - lastVisitedPage < THROTTLE_LIMIT)) {
        shouldLogPageView = false;
    } else {
        pageViewCache.set(cacheKey, now);
        if (pageViewCache.size > 5000) {
            pageViewCache.clear();
        }
    }

    res.on('finish', () => {
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
        const userAgent = (req.headers['user-agent'] || '').substring(0, 500);

        // If new 30-minute session, log session_start (represents 1 official visit)
        if (isNewSession) {
            db.query(
                `INSERT INTO analytics (id, session_id, event, page_url, user_agent, duration_ms, ip_address, created_at, updated_at) 
                 VALUES ($1, $2, 'session_start', $3, $4, 0, $5, NOW(), NOW())`,
                [uuidv4(), sessionId, pageUrl, userAgent, ip]
            ).catch(() => {});
        }

        // Log page_view
        if (shouldLogPageView) {
            db.query(
                `INSERT INTO analytics (id, session_id, event, page_url, user_agent, duration_ms, ip_address, created_at, updated_at) 
                 VALUES ($1, $2, 'page_view', $3, $4, 0, $5, NOW(), NOW())`,
                [uuidv4(), sessionId, pageUrl, userAgent, ip]
            ).catch(() => {});
        }
    });

    next();
};
