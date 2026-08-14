const DEFAULT_IMAGE = '/images/no-image.svg';

// Legacy alias overrides removed to ensure user-uploaded images and logos are NEVER hijacked or overwritten
const LEGACY_IMAGE_ALIASES = Object.freeze({});

function applyImageAlias(pathname) {
    return LEGACY_IMAGE_ALIASES[pathname] || pathname;
}

// Max allowed inline data URI size (10MB) — allows fallback base64 uploaded images
const MAX_INLINE_DATA_URI_SIZE = 10 * 1024 * 1024;

function normalizeImagePath(imgPath, fallback = DEFAULT_IMAGE) {
    const raw = String(imgPath || '').trim();
    if (!raw || raw.toLowerCase() === 'undefined' || raw.toLowerCase() === 'null' || raw.includes('placeholder.jpg') || raw.includes('Poster 1.png') || raw.includes('Poster 1.jpg') || raw.includes('hero-1.png')) {
        return fallback || DEFAULT_IMAGE;
    }

    // If it's a full image data URI, allow it
    if (raw.startsWith('data:image/')) {
        if (raw.length > MAX_INLINE_DATA_URI_SIZE) {
            console.warn(`[imagePaths] Blocked excessively large data URI (${(raw.length / 1024 / 1024).toFixed(1)}MB)`);
            return fallback || DEFAULT_IMAGE;
        }
        return raw;
    }

    if (raw.startsWith('data:')) {
        return raw;
    }

    if (raw.startsWith('http')) {
        return raw;
    }

    // Reject bare base64 strings (raw base64 without data: prefix)
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
