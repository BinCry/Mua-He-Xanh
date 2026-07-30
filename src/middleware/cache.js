const cacheManager = require('../config/redis');

/**
 * Cache middleware for Express API routes
 * @param {number} ttlSeconds - Cache duration in seconds (default 300s = 5 minutes)
 */
function apiCache(ttlSeconds = 300) {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        // Cache key based on original URL and session/user ID if relevant
        const userId = req.user ? req.user.id : 'guest';
        const cacheKey = `api:${req.originalUrl}:${userId}`;

        try {
            const cachedData = await cacheManager.get(cacheKey);
            if (cachedData) {
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=60`);
                return res.json(cachedData);
            }
        } catch (err) {
            console.error('Cache middleware get error:', err.message);
        }

        // Intercept res.json to cache response
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            if (res.statusCode === 200 && body && body.success !== false) {
                cacheManager.set(cacheKey, body, ttlSeconds).catch(err => {
                    console.error('Cache middleware set error:', err.message);
                });
            }
            res.setHeader('X-Cache', 'MISS');
            res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=60`);
            return originalJson(body);
        };

        next();
    };
}

/**
 * Helper to clear API cache by pattern
 * @param {string} prefix 
 */
async function clearApiCache(prefix = 'api:') {
    await cacheManager.clear(prefix);
}

module.exports = {
    apiCache,
    clearApiCache,
    cacheManager
};
