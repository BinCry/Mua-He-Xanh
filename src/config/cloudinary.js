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
    console.warn('⚠️  Cloudinary: Missing or placeholder credentials. Using local storage fallback.');
}

/**
 * Uploads a local file to Cloudinary or falls back to local relative path if Cloudinary is not configured.
 * @param {string} filePath - Absolute path to local file
 * @param {string} folder - Folder name in Cloudinary (e.g., 'binh-loi/media')
 * @returns {Promise<{url: string, public_id: string}>}
 */
const uploadToCloudinary = async (filePath, folder = 'binh-loi/media') => {
    try {
        if (isCloudinaryConfigured()) {
            const result = await cloudinary.uploader.upload(filePath, {
                folder: folder,
                resource_type: 'auto'
            });
            // Try to delete the temp local file after successful upload to Cloudinary
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (err) {
                console.error('Cloudinary: Error deleting local temp file:', err);
            }
            return {
                url: result.secure_url,
                public_id: result.public_id
            };
        } else {
            // Local fallback: convert to base64 data URL to persist across ephemeral Render restarts
            try {
                const ext = path.extname(filePath).toLowerCase();
                const mimeTypes = {
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                    '.webp': 'image/webp',
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav'
                };
                const mimeType = mimeTypes[ext] || 'application/octet-stream';
                const fileData = fs.readFileSync(filePath);
                const base64Data = fileData.toString('base64');
                const dataUrl = `data:${mimeType};base64,${base64Data}`;
                
                // Delete temporary file
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                
                console.log(`[CLOUDINARY FALLBACK] Converted ${ext} file to Base64 data URL.`);
                return {
                    url: dataUrl,
                    public_id: `local-base64-${Date.now()}`
                };
            } catch (err) {
                console.error('Cloudinary: Error converting fallback to base64:', err);
                const filename = path.basename(filePath);
                return {
                    url: `/uploads/media/${filename}`,
                    public_id: `local-fallback-${Date.now()}`
                };
            }
        }
    } catch (error) {
        console.error('Cloudinary: Upload error:', error);
        // Fallback to local on error
        const filename = path.basename(filePath);
        return {
            url: `/uploads/media/${filename}`,
            public_id: `local-error-${Date.now()}`
        };
    }
};

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    uploadToCloudinary
};
