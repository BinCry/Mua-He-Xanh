const fs = require('fs');
const path = require('path');

const UploadController = {
    /**
     * General image upload - saves to /uploads/media/ and returns URL path
     */
    uploadImage: (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có tệp nào được tải lên.' });
            }
            
            // Return the public URL path (relative to public/)
            const publicUrl = '/uploads/media/' + req.file.filename;
            
            res.json({
                success: true,
                message: 'Tải lên thành công!',
                url: publicUrl,
                path: publicUrl
            });
        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi server khi tải ảnh.' });
        }
    },

    /**
     * Logo upload - saves/overwrites logo to /images/logo.png and updates database settings
     */
    uploadLogo: async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có tệp nào được tải lên.' });
            }

            const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
            const logoFilename = 'logo' + ext;
            const destPath = path.join(__dirname, '../../public/images', logoFilename);

            // Copy uploaded file to /images/logo.xxx
            fs.copyFileSync(req.file.path, destPath);
            // Remove temp upload
            fs.unlinkSync(req.file.path);

            const publicUrl = '/images/' + logoFilename;

            // Automatically save to database settings table to ensure synchronization instantly
            const db = require('../core/database');
            await db.query(
                `INSERT INTO settings (key_name, key_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE key_value = ?`,
                ['brand_logo', publicUrl, publicUrl]
            );

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
