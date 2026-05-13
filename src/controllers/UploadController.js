const path = require('path');

const UploadController = {
    uploadImage: (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có tệp nào được tải lên.' });
            }
            
            // Return the relative path for use in DB
            const relativePath = 'uploads/media/' + req.file.filename;
            
            res.json({
                success: true,
                message: 'Tải lên thành công!',
                url: '/' + relativePath,
                path: relativePath
            });
        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi server khi tải ảnh.' });
        }
    }
};

module.exports = UploadController;
