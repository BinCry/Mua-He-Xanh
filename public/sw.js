const CACHE_NAME = 'binh-loi-healing-v1';
const STATIC_ASSETS = [
    '/offline.html',
    '/css/style-v5.css',
    '/images/logo.png',
    '/images/hero-1.png',
    '/images/hero-bg.jpg',
    '/manifest.json'
];

// Install Event
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Only handle GET requests
    if (req.method !== 'GET') {
        return;
    }

    // Static Assets Strategy: Cache-First
    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(cacheFirst(req));
        return;
    }

    // Dynamic Pages Strategy: Network-First
    event.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(req);
    return cachedResponse || fetch(req);
}

async function networkFirst(req) {
    const cache = await caches.open(CACHE_NAME);
    try {
        const networkResponse = await fetch(req);
        // Do not cache API requests or chrome-extensions
        if (!req.url.includes('/api/') && req.url.startsWith('http')) {
            cache.put(req, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await cache.match(req);
        if (cachedResponse) {
            return cachedResponse;
        }
        // If navigation request (HTML page), return offline page
        if (req.mode === 'navigate') {
            return cache.match('/offline.html');
        }
        return new Response('Network error happened', { status: 408, headers: { 'Content-Type': 'text/plain' } });
    }
}
