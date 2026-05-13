const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../core/database');
const fs = require('fs');
const sharp = require('sharp');

// Configure Storage (Use memoryStorage to process with Sharp before saving)
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|webp|gif/;
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error("Chỉ hỗ trợ định dạng ảnh (jpg, jpeg, png, webp, gif)"));
    }
}).single('file');

const MediaController = {
    // POST /api/admin/upload
    upload: (req, res) => {
        upload(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }
            if (!req.file) {
                return res.status(400).json({ success: false, message: "Không có file nào được chọn" });
            }

            try {
                const category = req.query.category || 'general';
                const uploadDir = path.join(__dirname, '../../public/uploads/', category);
                
                if (!fs.existsSync(uploadDir)) {
                    fs.mkdirSync(uploadDir, { recursive: true });
                }

                const filename = `processed-${Date.now()}-${uuidv4().substring(0, 8)}.webp`;
                const filePath = path.join(uploadDir, filename);
                const fileUrl = `/uploads/${category}/${filename}`;

                // Process with Sharp: Resize to 1200px width, convert to webp for optimization
                await sharp(req.file.buffer)
                    .resize(1200, null, { withoutEnlargement: true })
                    .webp({ quality: 80 })
                    .toFile(filePath);

                const id = uuidv4();
                const stats = fs.statSync(filePath);

                await db.query(`
                    INSERT INTO media_library (id, filename, original_name, mime_type, size, category, url)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [id, filename, req.file.originalname, 'image/webp', stats.size, category, fileUrl]);

                res.json({
                    success: true,
                    message: "Tải ảnh lên và tối ưu thành công",
                    data: {
                        id,
                        url: fileUrl,
                        name: req.file.originalname
                    }
                });
            } catch (error) {
                console.error("Upload/Processing error:", error);
                res.status(500).json({ success: false, message: "Lỗi xử lý ảnh: " + error.message });
            }
        });
    },

    // GET /api/admin/media
    list: async (req, res) => {
        try {
            const category = req.query.category || null;
            let query = "SELECT * FROM media_library";
            const params = [];

            if (category) {
                query += " WHERE category = ?";
                params.push(category);
            }
            query += " ORDER BY created_at DESC";

            const [rows] = await db.query(query, params);
            res.json({ success: true, data: rows });
        } catch (error) {
            console.error("Media list error:", error);
            res.status(500).json({ success: false, message: "Lỗi lấy danh sách ảnh" });
        }
    },

    // DELETE /api/admin/media/:id
    delete: async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await db.query("SELECT * FROM media_library WHERE id = ?", [id]);
            
            if (rows.length === 0) return res.status(404).json({ success: false, message: "Không tìm thấy file" });
            
            const file = rows[0];
            const filePath = path.join(__dirname, '../../public', file.url);
            
            // Delete from disk
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
            
            // Delete from DB
            await db.query("DELETE FROM media_library WHERE id = ?", [id]);
            
            res.json({ success: true, message: "Đã xóa ảnh" });
        } catch (error) {
            console.error("Delete media error:", error);
            res.status(500).json({ success: false, message: "Lỗi xóa file" });
        }
    }
};

module.exports = MediaController;
