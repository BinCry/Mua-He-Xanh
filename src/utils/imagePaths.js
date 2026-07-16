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

function inferImageMimeFromBase64(value) {
    if (value.startsWith('iVBORw0KGgo')) return 'image/png';
    if (value.startsWith('/9j/')) return 'image/jpeg';
    if (value.startsWith('R0lGOD')) return 'image/gif';
    if (value.startsWith('UklGR')) return 'image/webp';
    if (value.startsWith('PHN2Zy')) return 'image/svg+xml';
    return null;
}

function normalizeBareImageDataUrl(value) {
    const compact = value.replace(/\s/g, '');
    const mimeType = inferImageMimeFromBase64(compact);
    if (!mimeType) return null;
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
    return `data:${mimeType};base64,${compact}`;
}

function normalizeImagePath(imgPath, fallback = DEFAULT_IMAGE) {
    const raw = String(imgPath || '').trim();
    if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase() === 'null') {
        return normalizeImagePath(fallback || DEFAULT_IMAGE, DEFAULT_IMAGE);
    }

    if (raw.startsWith('http') || raw.startsWith('data:')) {
        return raw;
    }

    const dataUrl = normalizeBareImageDataUrl(raw);
    if (dataUrl) return dataUrl;

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
    normalizeImagePath,
    normalizeBareImageDataUrl
};
