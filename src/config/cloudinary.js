const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const config = require('./env');

const isCloudinaryConfigured = () => {
    const { cloudName, apiKey, apiSecret } = config.cloudinary || {};
    if (!cloudName || !apiKey || !apiSecret) return false;
    if (apiSecret.includes('<') || apiSecret.includes('placeholder')) return false;
    return true;
};

if (isCloudinaryConfigured()) {
    cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret
    });
}

/**
 * Uploads a file to Cloudinary or durable local storage.
 * Images must never fall back to data URIs: embedding them in database rows makes
 * HTML responses very large and bypasses normal browser/CDN image caching.
 */
const uploadToCloudinary = async (filePath, folder = 'binh-loi/media') => {
    try {
        if (isCloudinaryConfigured()) {
            try {
                const result = await cloudinary.uploader.upload(filePath, {
                    folder: folder,
                    resource_type: 'auto'
                });
                try {
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                } catch (err) {}
                return {
                    url: result.secure_url,
                    public_id: result.public_id
                };
            } catch (cloudErr) {
                console.warn('[UPLOAD] Cloudinary attempt failed:', cloudErr.message);
            }
        }

        // Tier 2: Try local file storage (/public/uploads/media/)
        try {
            const mediaDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'media');
            if (!fs.existsSync(mediaDir)) {
                fs.mkdirSync(mediaDir, { recursive: true });
            }

            const source = await sharp(filePath).rotate();
            const metadata = await source.metadata();
            const hasAlpha = Boolean(metadata.hasAlpha);
            const filename = `media-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.webp`;
            const destPath = path.join(mediaDir, filename);

            await source
                .resize(2560, 2560, { fit: 'inside', withoutEnlargement: true })
                .webp(hasAlpha ? { lossless: true } : { quality: 88 })
                .toFile(destPath);
            try {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            } catch (err) {}

            const publicUrl = `/uploads/media/${filename}`;
            console.log(`[UPLOAD] Saved local file to ${publicUrl}`);
            return {
                url: publicUrl,
                public_id: `local-${filename}`
            };
        } catch (fsErr) {
            throw new Error(`Unable to persist uploaded media: ${fsErr.message}`);
        }
    } catch (error) {
        console.error('[UPLOAD FATAL ERROR]:', error);
    }

    throw new Error('Unable to persist uploaded media. Please retry after storage is available.');
};

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    uploadToCloudinary
};
