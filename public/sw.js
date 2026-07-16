const CACHE_NAME = 'binh-loi-healing-v4';
const STATIC_ASSETS = [
    '/offline.html',
    '/css/style-v5.css',
    '/images/logo.png',
    '/images/hero-1.png',
    '/images/hero-bg.jpg'
];

const LEGACY_IMAGE_ALIASES = {
    '/images/cau-chu-z-1.png': '/uploads/destinations/cau-chu-u.jpg',
    '/images/xuong-nhang-1.png': '/uploads/destinations/xuong-nhang.jpg',
    '/images/chua-phap-tang-1.png': '/uploads/destinations/chua-phap-tang.png',
    '/images/vuon-mai-1.png': '/uploads/destinations/lang-mai.jpg',
    '/images/placeholder.png': '/images/hero-1.png',
    '/images/placeholder.jpg': '/images/hero-1.png'
};

function isBareBase64ImagePath(pathname) {
    const value = pathname.replace(/^\//, '');
    if (value.length < 512) return false;
    return value.startsWith('iVBORw0KGgo')
        || value.startsWith('/9j/')
        || value.startsWith('R0lGOD')
        || value.startsWith('UklGR')
        || value.startsWith('data:image');
}

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

    if (isBareBase64ImagePath(url.pathname)) {
        event.respondWith(cacheFirst(new Request(new URL('/images/hero-1.png', self.location.origin).toString())));
        return;
    }

    const legacyImageTarget = LEGACY_IMAGE_ALIASES[url.pathname];
    if (legacyImageTarget) {
        url.pathname = legacyImageTarget;
        event.respondWith(networkFirst(new Request(url.toString(), req)));
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
        if (networkResponse.ok && !req.url.includes('/api/') && req.url.startsWith('http')) {
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
