const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
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
    console.log('✅ Cloudinary configured successfully.');
} else {
    console.warn('⚠️  Cloudinary: Missing credentials. Using local file storage fallback (/uploads/media).');
}

/**
 * Uploads a file to Cloudinary (if configured) or moves to /public/uploads/media/ (if unconfigured/local fallback).
 * Never converts to base64 to avoid HTML payload bloat.
 * @param {string} filePath - Absolute path to temporary uploaded file
 * @param {string} folder - Folder name in Cloudinary
 * @returns {Promise<{url: string, public_id: string}>}
 */
const uploadToCloudinary = async (filePath, folder = 'binh-loi/media') => {
    try {
        if (isCloudinaryConfigured()) {
            const result = await cloudinary.uploader.upload(filePath, {
                folder: folder,
                resource_type: 'auto'
            });
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {}
            return {
                url: result.secure_url,
                public_id: result.public_id
            };
        } else {
            // Local file storage fallback: move file into /public/uploads/media/
            const mediaDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'media');
            if (!fs.existsSync(mediaDir)) {
                fs.mkdirSync(mediaDir, { recursive: true });
            }

            const ext = path.extname(filePath).toLowerCase();
            const filename = `media-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
            const destPath = path.join(mediaDir, filename);

            fs.copyFileSync(filePath, destPath);
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {}

            const publicUrl = `/uploads/media/${filename}`;
            console.log(`[LOCAL UPLOAD] Saved file to ${publicUrl}`);
            return {
                url: publicUrl,
                public_id: `local-${filename}`
            };
        }
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        // Fallback: move file into /public/uploads/media/
        try {
            if (fs.existsSync(filePath)) {
                const mediaDir = path.join(__dirname, '..', '..', 'public', 'uploads', 'media');
                if (!fs.existsSync(mediaDir)) {
                    fs.mkdirSync(mediaDir, { recursive: true });
                }
                const ext = path.extname(filePath).toLowerCase();
                const filename = `media-err-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
                const destPath = path.join(mediaDir, filename);
                fs.copyFileSync(filePath, destPath);
                try { fs.unlinkSync(filePath); } catch (e) {}

                const publicUrl = `/uploads/media/${filename}`;
                return {
                    url: publicUrl,
                    public_id: `local-err-${filename}`
                };
            }
        } catch (err) {}

        return {
            url: '/images/placeholder.jpg',
            public_id: `error-${Date.now()}`
        };
    }
};

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    uploadToCloudinary
};
