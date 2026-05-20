const fs = require('fs');

const UploadController = {
    uploadImage: (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Không có tệp nào được tải lên.' });
            }
            
            // Read the file and convert to base64
            const buffer = fs.readFileSync(req.file.path);
            const base64Data = `data:${req.file.mimetype};base64,${buffer.toString('base64')}`;
            
            // Delete local file to save storage
            fs.unlinkSync(req.file.path);
            
            res.json({
                success: true,
                message: 'Tải lên thành công!',
                url: base64Data,
                path: base64Data
            });
        } catch (error) {
            console.error('Upload Error:', error);
            res.status(500).json({ success: false, message: 'Lỗi server khi tải ảnh.' });
        }
    }
};

module.exports = UploadController;
