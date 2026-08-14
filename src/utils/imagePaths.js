const DEFAULT_IMAGE = '/images/Poster 1.jpg';

const LEGACY_IMAGE_ALIASES = Object.freeze({
    '/images/hero-1.png': '/uploads/destinations/chua-phap-tang.png',
    '/images/hero-2.png': '/uploads/destinations/xuong-nhang.jpg',
    '/images/hero-3.png': '/uploads/destinations/lang-mai.jpg',
    '/images/hero-4.png': '/uploads/destinations/cau-chu-u.jpg',
    '/images/hero-5.png': '/uploads/destinations/lang-le-park.jpg',
    '/images/hero-bg.jpg': '/uploads/destinations/chua-thanh-tam.png',
    '/images/chua-phap-tang-1.png': '/uploads/destinations/chua-phap-tang.png',
    '/images/xuong-nhang-1.png': '/uploads/destinations/xuong-nhang.jpg',
    '/images/vuon-mai-1.png': '/uploads/destinations/lang-mai.jpg',
    '/images/cau-chu-z-1.png': '/uploads/destinations/cau-chu-u.jpg',
    '/images/placeholder.png': '/uploads/destinations/chua-phap-tang.png',
    '/images/placeholder.jpg': '/uploads/destinations/chua-phap-tang.png',
    '/images/product-placeholder.png': '/uploads/destinations/vuon-dua.png',
    '/images/Poster 1.png': '/images/Poster 1.jpg',
    '/images/Poster 2.png': '/images/Poster 2.jpg',
    '/images/Poster 3.png': '/images/Poster 3.jpg',
    '/images/Poster 4.png': '/images/Poster 4.jpg',
    '/images/Poster 5.png': '/images/Poster 5.jpg',
    '/images/default-avatar.png': '/images/logo.svg',
    '/images/logo.png': '/images/logo.svg'
});

function applyImageAlias(pathname) {
    return LEGACY_IMAGE_ALIASES[pathname] || pathname;
}

// Max allowed inline data URI size (2KB) — anything larger MUST use a URL
const MAX_INLINE_DATA_URI_SIZE = 2048;

function normalizeImagePath(imgPath, fallback = DEFAULT_IMAGE) {
    const raw = String(imgPath || '').trim();
    if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase() === 'null') {
        return normalizeImagePath(fallback || DEFAULT_IMAGE, DEFAULT_IMAGE);
    }

    // If it's a full data URI, only allow small ones (favicons, tiny icons)
    if (raw.startsWith('data:')) {
        if (raw.length > MAX_INLINE_DATA_URI_SIZE) {
            // Large base64 in DB — refuse to inline, use fallback
            console.warn(`[imagePaths] Blocked large data URI (${(raw.length / 1024).toFixed(0)}KB) — use a URL instead`);
            return normalizeImagePath(fallback || DEFAULT_IMAGE, DEFAULT_IMAGE);
        }
        return raw;
    }

    if (raw.startsWith('http')) {
        return raw;
    }

    // Reject bare base64 strings (raw base64 without data: prefix)
    // These are the main culprits that caused 20MB HTML payloads
    if (/^[A-Za-z0-9+/]{100,}/.test(raw)) {
        console.warn(`[imagePaths] Blocked bare base64 string (${(raw.length / 1024).toFixed(0)}KB) — use a URL instead`);
        return normalizeImagePath(fallback || DEFAULT_IMAGE, DEFAULT_IMAGE);
    }

    let clean = raw.replace(/^public[\\\/]/, '').replace(/\\/g, '/');
    if (!clean.startsWith('/')) clean = '/' + clean;

    const queryStart = clean.indexOf('?');
    const pathname = queryStart >= 0 ? clean.slice(0, queryStart) : clean;
    const query = queryStart >= 0 ? clean.slice(queryStart) : '';

    return applyImageAlias(pathname) + query;
}

module.exports = {
    DEFAULT_IMAGE,
    LEGACY_IMAGE_ALIASES,
    normalizeImagePath
};
