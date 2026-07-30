const Redis = require('ioredis');
const config = require('./env');

class CacheManager {
    constructor() {
        this.redis = null;
        this.isRedisAvailable = false;
        this.inMemoryCache = new Map();
        this.initRedis();
    }

    initRedis() {
        try {
            const redisUrl = config.redis.url;
            this.redis = new Redis(redisUrl, {
                maxRetriesPerRequest: 1,
                retryStrategy: (times) => {
                    if (times > 3) {
                        if (this.isRedisAvailable) {
                            console.warn('⚠️ [REDIS] Redis disconnected. Falling back to In-Memory Cache.');
                        }
                        this.isRedisAvailable = false;
                        return null; // Stop retrying
                    }
                    return Math.min(times * 100, 2000);
                },
                lazyConnect: true,
                enableOfflineQueue: false
            });

            this.redis.connect().then(() => {
                this.isRedisAvailable = true;
                console.log(`✅ [REDIS] Connected to Redis server successfully (${redisUrl})`);
            }).catch((err) => {
                this.isRedisAvailable = false;
                console.log(`ℹ️ [CACHE] Redis unavailable (${err.message}). Using high-performance In-Memory Cache.`);
            });

            this.redis.on('error', (err) => {
                if (this.isRedisAvailable) {
                    console.warn('⚠️ [REDIS] Redis error:', err.message);
                }
                this.isRedisAvailable = false;
            });
        } catch (e) {
            this.isRedisAvailable = false;
            console.log('ℹ️ [CACHE] Using In-Memory Cache.');
        }
    }

    /**
     * Get item from cache
     * @param {string} key 
     * @returns {Promise<any>}
     */
    async get(key) {
        if (this.isRedisAvailable && this.redis) {
            try {
                const data = await this.redis.get(key);
                if (data) return JSON.parse(data);
            } catch (err) {
                this.isRedisAvailable = false;
            }
        }

        // Fallback to In-Memory Cache
        const item = this.inMemoryCache.get(key);
        if (item) {
            if (Date.now() < item.expiresAt) {
                return item.value;
            }
            this.inMemoryCache.delete(key);
        }
        return null;
    }

    /**
     * Set item in cache
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlSeconds 
     */
    async set(key, value, ttlSeconds = 300) {
        const jsonString = JSON.stringify(value);

        // Store in Memory Cache
        this.inMemoryCache.set(key, {
            value,
            expiresAt: Date.now() + ttlSeconds * 1000
        });

        // Store in Redis if available
        if (this.isRedisAvailable && this.redis) {
            try {
                await this.redis.set(key, jsonString, 'EX', ttlSeconds);
            } catch (err) {
                this.isRedisAvailable = false;
            }
        }
    }

    /**
     * Delete key from cache
     * @param {string} key 
     */
    async del(key) {
        this.inMemoryCache.delete(key);
        if (this.isRedisAvailable && this.redis) {
            try {
                await this.redis.del(key);
            } catch (err) {
                // ignore
            }
        }
    }

    /**
     * Clear all cached keys or keys matching a prefix
     * @param {string} prefix 
     */
    async clear(prefix = '') {
        if (!prefix) {
            this.inMemoryCache.clear();
        } else {
            for (const key of this.inMemoryCache.keys()) {
                if (key.startsWith(prefix)) {
                    this.inMemoryCache.delete(key);
                }
            }
        }

        if (this.isRedisAvailable && this.redis) {
            try {
                if (!prefix) {
                    await this.redis.flushdb();
                } else {
                    const keys = await this.redis.keys(`${prefix}*`);
                    if (keys.length > 0) {
                        await this.redis.del(...keys);
                    }
                }
            } catch (err) {
                // ignore
            }
        }
    }
}

module.exports = new CacheManager();
