const Model = require('../core/Model');
const { v4: uuidv4 } = require('uuid');

class VideoTemplate extends Model {
    constructor() {
        super('video_templates');
    }

    async ensureTableExists() {
        try {
            await this.db.query(`
                CREATE TABLE IF NOT EXISTS video_templates (
                    id VARCHAR(36) PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    cover_image TEXT,
                    preview_video_url TEXT,
                    audio_url TEXT,
                    audio_title VARCHAR(255) DEFAULT 'Nhạc nền Bình Lợi',
                    duration_seconds INT DEFAULT 15,
                    slots JSON,
                    is_active INT DEFAULT 1,
                    sort_order INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
                ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS description TEXT;
                ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS cover_image TEXT;
                ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 15;
                ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS slots JSON;
                ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS is_active INT DEFAULT 1;
                ALTER TABLE video_templates ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
            `);

            const [rows] = await this.db.query(`SELECT COUNT(*) as count FROM video_templates`);
            const count = parseInt(rows[0]?.count || 0, 10);
            if (count === 0) {
                await this.seedDefaultTemplates();
            }
        } catch (e) {
            console.error("VideoTemplate table init warning:", e.message);
        }
    }

    async seedDefaultTemplates() {
        try {
            const seedTemplates = [
                {
                    id: uuidv4(),
                    title: 'Bình Lợi Chữa Lành 15s (Hot Trend)',
                    description: 'Mẫu 4 phân cảnh nhịp điệu nhanh sôi động, phù hợp chia sẻ TikTok & Reels.',
                    cover_image: '/images/Poster 1.jpg',
                    preview_video_url: '',
                    audio_url: '/audio/peaceful_stream.mp3',
                    audio_title: 'Suối reo miệt vườn',
                    duration_seconds: 15,
                    sort_order: 1,
                    slots: JSON.stringify([
                        {
                            slot_index: 1,
                            title: 'Cảnh 1: Lạc vào miền xanh',
                            start_time: 0.0,
                            end_time: 3.75,
                            effect: 'kenburns',
                            filter: 'none',
                            subtitle: 'Lạc vào miền xanh Bình Lợi...',
                            default_img: '/images/Poster 1.jpg'
                        },
                        {
                            slot_index: 2,
                            title: 'Cảnh 2: Hương mai thanh mát',
                            start_time: 3.75,
                            end_time: 7.5,
                            effect: 'pan',
                            filter: 'warm',
                            subtitle: 'Hương mai thoang thoảng bờ kênh thanh mát.',
                            default_img: '/images/Poster 2.jpg'
                        },
                        {
                            slot_index: 3,
                            title: 'Cảnh 3: Chữa lành tâm hồn',
                            start_time: 7.5,
                            end_time: 11.25,
                            effect: 'dissolve',
                            filter: 'cool',
                            subtitle: 'Chữa lành từ những điều mộc mạc nhất.',
                            default_img: '/images/Poster 3.jpg'
                        },
                        {
                            slot_index: 4,
                            title: 'Cảnh 4: Trở về an yên',
                            start_time: 11.25,
                            end_time: 15.0,
                            effect: 'flash',
                            filter: 'vintage',
                            subtitle: 'Nghe Bình Lợi theo cách của bạn.',
                            default_img: '/images/Poster 4.jpg'
                        }
                    ])
                },
                {
                    id: uuidv4(),
                    title: 'Khám Phá Làng Mai Bình Lợi 20s',
                    description: 'Mẫu 4 phân cảnh êm đềm, chuyển cảnh mượt mà ngập tràn sắc hoa.',
                    cover_image: '/images/Poster 5.jpg',
                    preview_video_url: '',
                    audio_url: '/audio/peaceful_stream.mp3',
                    audio_title: 'Âm thanh Chữa lành Bình Lợi',
                    duration_seconds: 20,
                    sort_order: 2,
                    slots: JSON.stringify([
                        {
                            slot_index: 1,
                            title: 'Cảnh 1: Đón bình minh miệt vườn',
                            start_time: 0.0,
                            end_time: 5.0,
                            effect: 'kenburns',
                            filter: 'warm',
                            subtitle: 'Bình minh thức giấc trên những cánh đồng xanh.',
                            default_img: '/images/Poster 5.jpg'
                        },
                        {
                            slot_index: 2,
                            title: 'Cảnh 2: Lối đi bộ rợp bóng cây',
                            start_time: 5.0,
                            end_time: 10.0,
                            effect: 'pan',
                            filter: 'cool',
                            subtitle: 'Tiếng chim ríu rít len qua từng tán lá xanh rì.',
                            default_img: '/images/Poster 1.jpg'
                        },
                        {
                            slot_index: 3,
                            title: 'Cảnh 3: Thưởng thức trà thơm & nông sản',
                            start_time: 10.0,
                            end_time: 15.0,
                            effect: 'dissolve',
                            filter: 'warm',
                            subtitle: 'Ngọt ngào hương vị mộc mạc quê hương.',
                            default_img: '/images/Poster 2.jpg'
                        },
                        {
                            slot_index: 4,
                            title: 'Cảnh 4: Nụ cười du khách & Lời chào',
                            start_time: 15.0,
                            end_time: 20.0,
                            effect: 'kenburns',
                            filter: 'vintage',
                            subtitle: 'Hẹn gặp lại bạn tại Bình Lợi!',
                            default_img: '/images/Poster 3.jpg'
                        }
                    ])
                },
                {
                    id: uuidv4(),
                    title: 'Vlog Trải Nghiệm 30s (Toàn Cảnh Bình Lợi)',
                    description: 'Mẫu 5 phân cảnh dài chi tiết, phù hợp làm vlog tổng kết chuyến đi.',
                    cover_image: '/images/Poster 4.jpg',
                    preview_video_url: '',
                    audio_url: '/audio/peaceful_stream.mp3',
                    audio_title: 'Âm thanh Chữa lành Bình Lợi',
                    duration_seconds: 30,
                    sort_order: 3,
                    slots: JSON.stringify([
                        {
                            slot_index: 1,
                            title: 'Cảnh 1: Khởi đầu hành trình',
                            start_time: 0.0,
                            end_time: 6.0,
                            effect: 'kenburns',
                            filter: 'none',
                            subtitle: 'Chào mừng bạn đến với vùng đất Bình Lợi yên bình.',
                            default_img: '/images/Poster 4.jpg'
                        },
                        {
                            slot_index: 2,
                            title: 'Cảnh 2: Làng Mai vàng trứ danh',
                            start_time: 6.0,
                            end_time: 12.0,
                            effect: 'pan',
                            filter: 'warm',
                            subtitle: 'Sắc vàng rực rỡ bên bờ kênh trong vắt.',
                            default_img: '/images/Poster 1.jpg'
                        },
                        {
                            slot_index: 3,
                            title: 'Cảnh 3: Trải nghiệm chèo SUP / Xuồng',
                            start_time: 12.0,
                            end_time: 18.0,
                            effect: 'dissolve',
                            filter: 'cool',
                            subtitle: 'Lướt nhẹ trên dòng nước mát lành, buông bỏ muộn phiền.',
                            default_img: '/images/Poster 2.jpg'
                        },
                        {
                            slot_index: 4,
                            title: 'Cảnh 4: Ẩm thực đồng quê đặc sắc',
                            start_time: 18.0,
                            end_time: 24.0,
                            effect: 'pan',
                            filter: 'warm',
                            subtitle: 'Mâm cơm quê đậm đà nghĩa tình sông nước.',
                            default_img: '/images/Poster 3.jpg'
                        },
                        {
                            slot_index: 5,
                            title: 'Cảnh 5: Hoàng hôn lưu luyến',
                            start_time: 24.0,
                            end_time: 30.0,
                            effect: 'flash',
                            filter: 'vintage',
                            subtitle: 'Bình Lợi - Nơi trở về để tìm lại an yên.',
                            default_img: '/images/Poster 5.jpg'
                        }
                    ])
                }
            ];

            for (const tpl of seedTemplates) {
                await this.db.query(
                    `INSERT INTO video_templates (id, title, description, cover_image, preview_video_url, audio_url, audio_title, duration_seconds, slots, is_active, sort_order, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
                     ON CONFLICT (id) DO NOTHING`,
                    [tpl.id, tpl.title, tpl.description, tpl.cover_image, tpl.preview_video_url, tpl.audio_url, tpl.audio_title, tpl.duration_seconds, tpl.slots, 1, tpl.sort_order]
                );
            }
            console.log('Seeded default video templates successfully!');
        } catch (e) {
            console.error('Seed video templates warning:', e.message);
        }
    }

    async getActive() {
        try {
            const [rows] = await this.db.query(
                `SELECT * FROM ${this.table} WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC`
            );
            return rows.map(r => this.parseSlots(r));
        } catch (e) {
            console.error("VideoTemplate getActive error:", e.message);
            return [];
        }
    }

    async getAll() {
        try {
            const [rows] = await this.db.query(
                `SELECT * FROM ${this.table} ORDER BY sort_order ASC, created_at DESC`
            );
            return rows.map(r => this.parseSlots(r));
        } catch (e) {
            console.error("VideoTemplate getAll error:", e.message);
            return [];
        }
    }

    async getById(id) {
        try {
            const [rows] = await this.db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
            if (!rows || rows.length === 0) return null;
            return this.parseSlots(rows[0]);
        } catch (e) {
            console.error("VideoTemplate getById error:", e.message);
            return null;
        }
    }

    parseSlots(row) {
        if (!row) return row;
        try {
            if (typeof row.slots === 'string') {
                row.slots = JSON.parse(row.slots);
            }
        } catch (e) {
            row.slots = [];
        }
        return row;
    }
}

const videoTemplateInstance = new VideoTemplate();
(async () => {
    try {
        await videoTemplateInstance.ensureTableExists();
    } catch(e) {
        console.error('VideoTemplate auto-init:', e);
    }
})();

module.exports = videoTemplateInstance;
