const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configure storage with dynamic writability check
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath = os.tmpdir();
        try {
            const localPath = path.join(__dirname, '../../public/uploads/media');
            if (!fs.existsSync(localPath)) {
                fs.mkdirSync(localPath, { recursive: true });
            }
            const testFile = path.join(localPath, `.write_test_${Date.now()}`);
            fs.writeFileSync(testFile, 'w');
            fs.unlinkSync(testFile);
            uploadPath = localPath;
        } catch (e) {
            uploadPath = os.tmpdir();
        }

        if (!fs.existsSync(uploadPath)) {
            try { fs.mkdirSync(uploadPath, { recursive: true }); } catch (e) {}
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'file-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter (images and audio)
const fileFilter = (req, file, cb) => {
    if (
        file.mimetype.startsWith('image/') ||
        file.mimetype.startsWith('audio/') ||
        file.mimetype === 'application/octet-stream'
    ) {
        cb(null, true);
    } else {
        cb(new Error('Chỉ được phép tải lên hình ảnh hoặc âm thanh!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

module.exports = upload;
