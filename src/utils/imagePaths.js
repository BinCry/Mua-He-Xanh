const DEFAULT_IMAGE = '/images/hero-1.png';

const LEGACY_IMAGE_ALIASES = Object.freeze({
    '/images/chua-phap-tang-1.png': '/uploads/destinations/chua-phap-tang.png',
    '/images/xuong-nhang-1.png': '/uploads/destinations/xuong-nhang.jpg',
    '/images/vuon-mai-1.png': '/uploads/destinations/lang-mai.jpg',
    '/images/cau-chu-z-1.png': '/uploads/destinations/cau-chu-u.jpg',
    '/images/hero-2.png': DEFAULT_IMAGE,
    '/images/hero-3.png': '/images/hero-bg.jpg',
    '/images/nature-bg.jpg': '/images/hero-bg.jpg',
    '/images/placeholder.png': DEFAULT_IMAGE,
    '/images/placeholder.jpg': DEFAULT_IMAGE,
    '/images/product-placeholder.png': DEFAULT_IMAGE,
    '/images/default-avatar.png': '/images/logo.png'
});

function applyImageAlias(pathname) {
    return LEGACY_IMAGE_ALIASES[pathname] || pathname;
}

function normalizeImagePath(imgPath, fallback = DEFAULT_IMAGE) {
    const raw = String(imgPath || '').trim();
    if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase() === 'null') {
        return normalizeImagePath(fallback || DEFAULT_IMAGE, DEFAULT_IMAGE);
    }

    if (raw.startsWith('http') || raw.startsWith('data:')) {
        return raw;
    }

    let clean = raw.replace(/^public[\\/]/, '').replace(/\\/g, '/');
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
