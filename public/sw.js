const CACHE_NAME = 'binh-loi-healing-v12';
const STATIC_ASSETS = [
    '/css/style-v5.css',
    '/images/logo.png',
    '/images/no-image.svg'
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

// Activate Event — delete ALL old caches aggressively
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

    // NEVER intercept offline.html — always fetch fresh from network
    if (url.pathname === '/offline.html') {
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
        // Only cache static asset resources (images, css, js, fonts) to prevent storage bloat
        const isStaticAsset = req.url.match(/\.(css|js|png|jpg|jpeg|webp|svg|woff2?|ico)(\?.*)?$/i);
        if (networkResponse.ok && isStaticAsset && !req.url.includes('/api/') && req.url.startsWith('http')) {
            cache.put(req, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await cache.match(req);
        if (cachedResponse) {
            return cachedResponse;
        }
        // If navigation request (HTML page), show offline page from network (not cache)
        if (req.mode === 'navigate') {
            try {
                return await fetch('/offline.html');
            } catch (e) {
                // If even offline.html can't load, return a minimal inline response
                return new Response(
                    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Du Lịch Bình Lợi</title></head>' +
                    '<body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fafafa;margin:0">' +
                    '<div style="text-align:center;padding:2rem">' +
                    '<h1 style="color:#922724;font-size:1.8rem;font-weight:900;letter-spacing:1px">DU LỊCH BÌNH LỢI</h1>' +
                    '<p style="color:#15803d;font-weight:700;margin-top:4px">Chạm sắc bản nguyên</p>' +
                    '<h3 style="margin-top:1.5rem;color:#333">Đang kết nối máy chủ...</h3>' +
                    '<p style="color:#666;font-size:0.9rem">Máy chủ đang cập nhật. Trang sẽ tự động tải lại.</p>' +
                    '<button onclick="location.reload()" style="margin-top:1rem;padding:12px 32px;background:linear-gradient(135deg,#922724,#b83330);color:#fff;border:none;border-radius:50px;font-weight:700;cursor:pointer">Thử lại</button>' +
                    '<script>setInterval(function(){fetch("/",{method:"HEAD",cache:"no-store",mode:"no-cors"}).then(function(r){if(r.ok||r.type==="opaque")location.reload()}).catch(function(){})},5000)<\/script>' +
                    '</div></body></html>',
                    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
                );
            }
        }
        return new Response('Network error happened', { status: 408, headers: { 'Content-Type': 'text/plain' } });
    }
}
