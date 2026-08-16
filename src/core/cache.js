/**
 * High-Performance In-Memory Cache Engine
 * Zero-latency RAM cache with automatic TTL expiration & pattern-based invalidation.
 */
class MemoryCache {
    constructor() {
        this.store = new Map();
        // Periodic auto-cleanup every 60 seconds
        if (typeof setInterval !== 'undefined') {
            const timer = setInterval(() => this.cleanup(), 60000);
            if (timer && timer.unref) timer.unref();
        }
    }

    /**
     * Get a value from cache
     * @param {string} key
     * @returns {any|null}
     */
    get(key) {
        const item = this.store.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.store.delete(key);
            return null;
        }
        return item.value;
    }

    /**
     * Set a value in cache with TTL (Time To Live in seconds)
     * @param {string} key
     * @param {any} value
     * @param {number} ttlSeconds - Default 300s (5 minutes)
     * @returns {any}
     */
    set(key, value, ttlSeconds = 300) {
        this.store.set(key, {
            value,
            expiry: Date.now() + (ttlSeconds * 1000)
        });
        return value;
    }

    /**
     * Delete a key or all keys matching a wildcard pattern (e.g., 'shops:*')
     * @param {string} keyOrPattern
     */
    del(keyOrPattern) {
        if (!keyOrPattern || typeof keyOrPattern !== 'string') return;
        if (keyOrPattern.includes('*')) {
            const regex = new RegExp('^' + keyOrPattern.replace(/\*/g, '.*') + '$');
            for (const k of this.store.keys()) {
                if (regex.test(k)) {
                    this.store.delete(k);
                }
            }
        } else {
            this.store.delete(keyOrPattern);
        }
    }

    /**
     * Clear all cached items
     */
    flush() {
        this.store.clear();
    }

    /**
     * Remove expired keys to free memory
     */
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.store.entries()) {
            if (now > item.expiry) {
                this.store.delete(key);
            }
        }
    }
}

module.exports = new MemoryCache();
