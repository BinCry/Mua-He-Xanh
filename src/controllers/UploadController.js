const fs = require('fs');
const path = require('path');
const { uploadToCloudinary } = require('../config/cloudinary');

const UploadController = {
    /**
     * General image upload - saves to Cloudinary and returns URL path
     */
    uploadImage: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có tệp nào được tải lên.' });
            }
            
            const result = await uploadToCloudinary(req.file.path, 'binh-loi/media');
            
            res.json({
                success: true,
                message: 'Tải lên thành công!',
                url: result.url,
                path: result.url
            });
        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi server khi tải ảnh.' });
        }
    },

    /**
     * Logo upload - saves to Cloudinary and updates database settings
     */
    uploadLogo: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có tệp nào được tải lên.' });
            }

            const result = await uploadToCloudinary(req.file.path, 'binh-loi/brand');
            const publicUrl = result.url;

            const db = require('../core/database');
            await db.query(
                `INSERT INTO settings (key_name, key_value) VALUES ($1, $2) ON CONFLICT (key_name) DO UPDATE SET key_value = EXCLUDED.key_value`,
                ['brand_logo', publicUrl]
            );

            // Invalidate RAM cache so the new logo appears immediately on all pages
            global._settingsCache = null;
            global._settingsCacheTime = 0;

            res.json({
                success: true,
                message: 'Logo đã được cập nhật!',
                url: publicUrl,
                path: publicUrl
            });
        } catch (error) {
            console.error('Logo Upload Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi server khi tải logo.' });
        }
    }
};

module.exports = UploadController;
