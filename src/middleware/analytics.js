/**
 * Analytics Middleware - Pure PostgreSQL
 * Implements User's Custom Visit Rule:
 * 1. Initial visit from an IP: +1 visit (session_start)
 * 2. Continuously on site: +1 visit for every 30 minutes active
 * 3. Exit website (inactivity > 15m) & return: starts new cycle (+1 visit)
 * 4. Sub-actions (videos, images, clicks, assets): NO extra visits
 * 5. Excludes admin IPs and bots
 */
const db = require('../core/database');
const { v4: uuidv4 } = require('uuid');

const pageViewCache = new Map();
// ipSessionMap: ip -> { sessionStart: timestamp, lastActivity: timestamp, intervalsCounted: number }
const ipSessionMap = new Map();

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity means user exited
const BLOCK_30M_MS = 30 * 60 * 1000;          // 30 minutes continuous stay = +1 visit

const ADMIN_IPS = new Set(['222.253.43.189', '27.64.29.198', '127.0.0.1', '::1']);
const BOT_REGEX = /bot|spider|crawl|python|curl|wget|zgrab|scan|infrawatch|censys|forestengine|headless/i;

module.exports = function analyticsMiddleware(req, res, next) {
    // Only track GET requests to actual HTML pages (skip API, manifest, sw, static assets, media)
    if (
        req.method !== 'GET' || 
        req.path.startsWith('/api/') || 
        req.path === '/manifest.json' || 
        req.path === '/sw.js' || 
        req.path === '/offline.html' || 
        req.path === '/favicon.ico' || 
        req.path === '/robots.txt' || 
        req.path === '/sitemap.xml' || 
        req.path.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|webp|mp4|webm|mp3|ogg|wav|json)$/)
    ) {
        return next();
    }

    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || 'unknown';
    const userAgent = (req.headers['user-agent'] || '').substring(0, 500);

    // Skip tracking for Admin IP and automated bots
    if (ADMIN_IPS.has(ip) || BOT_REGEX.test(userAgent) || userAgent.length < 15) {
        return next();
    }

    const now = Date.now();
    
    // Maintain cookie session_uuid
    let sessionId = req.cookies?.session_uuid;
    if (!sessionId) {
        sessionId = uuidv4();
        res.cookie('session_uuid', sessionId, { maxAge: 30 * 24 * 3600 * 1000, httpOnly: false, sameSite: 'lax' });
        if (!req.cookies) req.cookies = {};
        req.cookies.session_uuid = sessionId;
    }

    const pageUrl = req.originalUrl;
    const cacheKey = `${sessionId}:${pageUrl}`;

    // Session logic per IP
    const sessionKey = ip;
    let sessionData = ipSessionMap.get(sessionKey);
    let isNewVisit = false;
    let extraVisits = 0;

    if (!sessionData || (now - sessionData.lastActivity > INACTIVITY_TIMEOUT_MS)) {
        // User just arrived or exited and returned after > 15m
        isNewVisit = true;
        sessionData = {
            sessionStart: now,
            lastActivity: now,
            intervalsCounted: 0
        };
        ipSessionMap.set(sessionKey, sessionData);
    } else {
        // User is continuously browsing
        const continuousDuration = now - sessionData.sessionStart;
        const intervalsNow = Math.floor(continuousDuration / BLOCK_30M_MS);
        if (intervalsNow > sessionData.intervalsCounted) {
            extraVisits = intervalsNow - sessionData.intervalsCounted;
            sessionData.intervalsCounted = intervalsNow;
        }
        sessionData.lastActivity = now;
    }

    // Keep memory map bounded
    if (ipSessionMap.size > 20000) {
        const cutoff = now - INACTIVITY_TIMEOUT_MS;
        for (const [k, v] of ipSessionMap.entries()) {
            if (v.lastActivity < cutoff) ipSessionMap.delete(k);
        }
    }

    // 3s throttle per identical page URL to avoid double-counting reloads
    const lastVisitedPage = pageViewCache.get(cacheKey);
    let shouldLogPageView = true;
    if (lastVisitedPage && (now - lastVisitedPage < 3000)) {
        shouldLogPageView = false;
    } else {
        pageViewCache.set(cacheKey, now);
        if (pageViewCache.size > 5000) pageViewCache.clear();
    }

    res.on('finish', () => {
        // 1. New visit when entering or returning
        if (isNewVisit) {
            db.query(
                `INSERT INTO analytics (id, session_id, event, page_url, user_agent, duration_ms, ip_address, created_at, updated_at) 
                 VALUES ($1, $2, 'session_start', $3, $4, 0, $5, NOW(), NOW())`,
                [uuidv4(), sessionId, pageUrl, userAgent, ip]
            ).catch(() => {});
        }

        // 2. Extra visits for every 30 minutes continuous stay
        if (extraVisits > 0) {
            for (let i = 0; i < extraVisits; i++) {
                db.query(
                    `INSERT INTO analytics (id, session_id, event, page_url, user_agent, duration_ms, ip_address, created_at, updated_at) 
                     VALUES ($1, $2, 'session_start', $3, $4, 0, $5, NOW(), NOW())`,
                    [uuidv4(), sessionId, pageUrl, userAgent, ip]
                ).catch(() => {});
            }
        }

        // 3. Log standard page_view
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

