const CACHE_NAME = 'binh-loi-healing-v16';
const STATIC_ASSETS = [
    '/css/style-v5.css',
    '/images/logo.png',
    '/images/no-image.svg',
    '/offline.html'
];

const OFFLINE_FALLBACK_HTML = [
    '<!DOCTYPE html><html lang="vi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#922724"><title>Kết nối đang gián đoạn | Du Lịch Bình Lợi</title>',
    '<style>:root{--p:#922724;--pd:#761f1d;--g:#15803d;--page:#faf9f7;--text:#262321;--muted:#66615d;--border:#ebe4df;--soft:#fdf0ee}*{box-sizing:border-box}html,body{min-height:100%}body{min-height:100vh;min-height:100dvh;margin:0;background:var(--page);color:var(--text);font-family:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif}.page{min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:clamp(24px,7vh,72px) clamp(16px,4vw,32px)}.shell{width:min(100%,440px);display:grid;justify-items:center;gap:clamp(20px,4vh,32px);text-align:center}.brand{margin:0;color:var(--p);font-size:clamp(1.5rem,4.5vw,2rem);font-weight:800;letter-spacing:.045em;line-height:1.15}.tagline{margin:.45rem 0 0;color:var(--g);font-family:Georgia,"Times New Roman",serif;font-size:clamp(1rem,3.5vw,1.15rem);font-style:italic;font-weight:700}.card{width:100%;padding:clamp(24px,6vw,40px);background:#fff;border:1px solid var(--border);border-radius:clamp(18px,4vw,24px);box-shadow:0 12px 30px rgba(74,45,35,.07)}.icon{width:clamp(52px,14vw,64px);aspect-ratio:1;display:grid;place-items:center;margin:0 auto clamp(18px,3vh,24px);border-radius:50%;background:var(--soft);color:var(--p)}.icon svg{width:55%;height:55%}.card h1{margin:0;font-size:clamp(1.125rem,3.8vw,1.375rem);font-weight:750;letter-spacing:-.015em;line-height:1.3;text-wrap:balance}.desc{max-width:34ch;margin:.85rem auto 0;color:var(--muted);font-size:clamp(.875rem,2.8vw,1rem);line-height:1.65;text-wrap:pretty}.status{display:flex;align-items:center;justify-content:center;gap:.5rem;margin:clamp(18px,3vh,24px) 0;color:#766f6a;font-size:.875rem;line-height:1.4}.spin{width:1rem;height:1rem;flex:0 0 auto;border:2px solid #e4d8d3;border-top-color:var(--p);border-radius:50%;animation:spin .85s linear infinite}.retry{min-width:160px;min-height:48px;padding:.75rem 1.35rem;border:1px solid var(--p);border-radius:999px;background:var(--p);color:#fff;cursor:pointer;font:inherit;font-size:.95rem;font-weight:700;line-height:1.2;transition:background-color 180ms ease,border-color 180ms ease,transform 180ms ease,box-shadow 180ms ease}.retry:hover{background:var(--pd);border-color:var(--pd);box-shadow:0 6px 16px rgba(146,39,36,.2)}.retry:active{transform:scale(.98)}.retry:focus-visible{outline:3px solid rgba(146,39,36,.32);outline-offset:3px}@keyframes spin{to{transform:rotate(360deg)}}@media(max-height:600px){.page{align-items:flex-start}.shell{gap:18px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}</style></head>',
    '<body><main class="page" aria-labelledby="title"><div class="shell"><header><p class="brand">DU LỊCH BÌNH LỢI</p><p class="tagline">Chạm sắc bản nguyên</p></header><section class="card" role="status" aria-live="polite"><div class="icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5.2 10.2a10 10 0 0 1 12.6 0"></path><path d="M8.1 13.2a5.9 5.9 0 0 1 5.1-.8"></path><path d="M12 18.2h.01"></path><path d="M3.5 3.5 20.5 20.5"></path></svg></div><h1 id="title">Kết nối đang gián đoạn</h1><p class="desc">Không thể kết nối đến hệ thống. Chúng tôi sẽ tự động thử lại khi kết nối được khôi phục.</p><p class="status"><span class="spin" aria-hidden="true"></span><span>Đang thử kết nối lại...</span></p><button class="retry" type="button" onclick="retryConnection()">Thử lại ngay</button></section></div></main>',
    '<script>function retryConnection(){fetch("/api/health",{cache:"no-store"}).then(function(r){if(r.ok)location.replace("/")}).catch(function(){})}setInterval(retryConnection,5000);retryConnection()<\/script></body></html>'
].join('').replace('</head>', '<style>.tagline{color:#1e5a3e;font-family:"Segoe UI",system-ui,-apple-system,BlinkMacSystemFont,sans-serif;font-style:normal;letter-spacing:0;line-height:1.35}.tagline:after{content:"";display:block;width:3rem;height:2px;margin:.35rem auto 0;border-radius:999px;background:linear-gradient(90deg,#1e5a3e 0 68%,#f0a500 68% 100%)}</style></head>');

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

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => Promise.all(
            cacheNames.map((cache) => cache !== CACHE_NAME && caches.delete(cache))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.method !== 'GET') return;

    // Keep the dedicated fallback available even when the network is unavailable.
    if (url.pathname === '/offline.html') {
        event.respondWith(cacheFirst(req));
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

    if (STATIC_ASSETS.includes(url.pathname)) {
        event.respondWith(cacheFirst(req));
        return;
    }

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
        const isStaticAsset = req.url.match(/\.(css|js|png|jpg|jpeg|webp|svg|woff2?|ico)(\?.*)?$/i);
        if (networkResponse.ok && isStaticAsset && !req.url.includes('/api/') && req.url.startsWith('http')) {
            cache.put(req, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        const cachedResponse = await cache.match(req);
        if (cachedResponse) return cachedResponse;

        if (req.mode === 'navigate') {
            try {
                return await fetch('/offline.html');
            } catch (offlineError) {
                return new Response(OFFLINE_FALLBACK_HTML, {
                    status: 503,
                    headers: { 'Content-Type': 'text/html; charset=utf-8' }
                });
            }
        }

        return new Response('Network error happened', {
            status: 408,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
