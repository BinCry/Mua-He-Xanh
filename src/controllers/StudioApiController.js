const db = require('../core/database');

const StudioApiController = {
    // 1. Get all published video templates
    getTemplates: async (req, res) => {
        try {
            const { category } = req.query;
            let sql = 'SELECT * FROM video_templates WHERE is_published = true';
            const params = [];
            if (category && category !== 'all') {
                sql += ' AND category = $1';
                params.push(category);
            }
            sql += ' ORDER BY id ASC';
            const [templates] = await db.query(sql, params);
            res.json({ success: true, templates });
        } catch (err) {
            console.error('getTemplates error:', err);
            res.status(500).json({ success: false, message: 'Lỗi tải danh sách mẫu video: ' + err.message });
        }
    },

    // 2. Get single template by template_id or id
    getTemplateById: async (req, res) => {
        try {
            const { id } = req.params;
            const [rows] = await db.query(
                'SELECT * FROM video_templates WHERE template_id = $1 OR id::text = $1 LIMIT 1',
                [id]
            );
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy mẫu video' });
            }
            res.json({ success: true, template: rows[0] });
        } catch (err) {
            console.error('getTemplateById error:', err);
            res.status(500).json({ success: false, message: 'Lỗi máy chủ: ' + err.message });
        }
    },

    // 3. Get destinations list with images for location generator
    getDestinations: async (req, res) => {
        try {
            const [destinations] = await db.query(`
                SELECT id, name, slug, description, short_desc, cover_image, gallery, type 
                FROM destinations 
                WHERE is_active = 1 
                ORDER BY name ASC
            `);
            res.json({ success: true, destinations });
        } catch (err) {
            console.error('getDestinations error:', err);
            res.status(500).json({ success: false, message: 'Lỗi tải danh sách điểm đến: ' + err.message });
        }
    },

    // 4. Auto-generate video project from location
    generateLocationVideo: async (req, res) => {
        try {
            const { destination_id, style = 'chill' } = req.body;
            if (!destination_id) {
                return res.status(400).json({ success: false, message: 'Vui lòng chọn điểm đến Bình Lợi' });
            }

            const [destRows] = await db.query(
                'SELECT * FROM destinations WHERE id = $1 OR slug = $1 LIMIT 1',
                [destination_id]
            );

            if (destRows.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy điểm đến này' });
            }

            const dest = destRows[0];
            const destName = dest.name || 'Bình Lợi';

            // Collect all available photos for this destination
            let photos = [];
            if (dest.cover_image) photos.push(dest.cover_image);

            if (dest.gallery) {
                try {
                    let parsed = typeof dest.gallery === 'string' ? JSON.parse(dest.gallery) : dest.gallery;
                    if (Array.isArray(parsed)) {
                        parsed.forEach(p => {
                            const url = typeof p === 'string' ? p : p?.url || p?.image;
                            if (url && !photos.includes(url)) photos.push(url);
                        });
                    }
                } catch (e) {
                    if (typeof dest.gallery === 'string' && dest.gallery.includes(',')) {
                        dest.gallery.split(',').forEach(s => {
                            const trimmed = s.trim();
                            if (trimmed && !photos.includes(trimmed)) photos.push(trimmed);
                        });
                    }
                }
            }

            // Fallback photos from curated hero posters if less than 4 photos
            const fallbackPhotos = [
                '/images/cung-yen-lan-toa.jpg',
                '/images/Poster 1.jpg',
                '/images/Poster 2.jpg',
                '/images/Poster 3.jpg',
                '/images/Poster 4.jpg',
                '/images/Poster 5.jpg'
            ];

            for (const fb of fallbackPhotos) {
                if (photos.length < 5 && !photos.includes(fb)) {
                    photos.push(fb);
                }
            }

            // Fetch ambient soundscape or soothing audio
            const [soundRows] = await db.query(
                'SELECT * FROM soundscapes WHERE is_active = 1 ORDER BY RANDOM() LIMIT 1'
            );
            const audioSrc = soundRows[0]?.audio_url || '/media/audio_dest_1773041530737.mp3';
            const audioTitle = soundRows[0]?.title || 'Âm vang đồng quê Bình Lợi';

            // Build storyboard clips & synced text captions
            const slotDuration = style === 'fast' ? 2.5 : 3.5;
            const transitions = ['fade', 'slide', 'zoom', 'wipe', 'fade'];

            const sampleCaptions = [
                `Khám phá ${destName}`,
                'Bình yên giữa ngát xanh quê nhà',
                'Nét đẹp thanh khiết mộc mạc',
                'Hít thở trọn vẹn an yên',
                'Bình Lợi Healing • Hẹn gặp bạn!'
            ];

            const clips = [];
            const texts = [];
            let currentTime = 0;

            const totalSlots = Math.min(photos.length, 5);
            for (let i = 0; i < totalSlots; i++) {
                const clipDuration = slotDuration;
                clips.push({
                    id: 'clip_' + Date.now() + '_' + i,
                    src: photos[i],
                    name: `${destName} - Cảnh ${i + 1}`,
                    startTime: currentTime,
                    duration: clipDuration,
                    volume: 1,
                    transition: transitions[i % transitions.length]
                });

                texts.push({
                    id: 'txt_' + Date.now() + '_' + i,
                    text: sampleCaptions[i] || `${destName} ✨`,
                    startTime: currentTime + 0.2,
                    duration: clipDuration - 0.4,
                    x: 270, // center for 540x960 9:16
                    y: 780, // lower third
                    fontSize: 26,
                    fontFamily: 'Montserrat, sans-serif',
                    color: '#FFFFFF',
                    bgColor: 'rgba(0, 0, 0, 0.65)',
                    animation: i === 0 ? 'fade' : 'pop'
                });

                currentTime += clipDuration;
            }

            const projectConfig = {
                title: `Khám phá ${destName} – Bình Lợi Studio`,
                aspect_ratio: '9:16',
                duration: currentTime,
                clips,
                texts,
                audio: {
                    src: audioSrc,
                    title: audioTitle,
                    duration: currentTime,
                    volume: 0.8
                }
            };

            res.json({
                success: true,
                message: `Đã tạo video giới thiệu ${destName} thành công!`,
                project: projectConfig
            });
        } catch (err) {
            console.error('generateLocationVideo error:', err);
            res.status(500).json({ success: false, message: 'Lỗi tạo video từ điểm đến: ' + err.message });
        }
    },

    // 5. Save user project
    saveProject: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            const { id, title, aspect_ratio, duration, project_data, thumbnail } = req.body;

            if (!project_data) {
                return res.status(400).json({ success: false, message: 'Dữ liệu dự án không hợp lệ' });
            }

            if (!user) {
                // Guest mode: project saved locally
                return res.json({
                    success: true,
                    is_guest: true,
                    message: 'Dự án đã được lưu an toàn trên trình duyệt của bạn (F5 không mất)'
                });
            }

            let projectId = id;
            if (projectId) {
                // Check ownership
                const [exists] = await db.query(
                    'SELECT id FROM studio_projects WHERE id = $1 AND user_id = $2',
                    [projectId, user.id]
                );
                if (exists.length > 0) {
                    await db.query(`
                        UPDATE studio_projects 
                        SET title = $1, aspect_ratio = $2, duration = $3, project_data = $4, thumbnail = $5, updated_at = CURRENT_TIMESTAMP
                        WHERE id = $6 AND user_id = $7
                    `, [title || 'Dự án chưa đặt tên', aspect_ratio || '9:16', duration || 15, JSON.stringify(project_data), thumbnail || null, projectId, user.id]);
                } else {
                    projectId = null;
                }
            }

            if (!projectId) {
                const [insertRes] = await db.query(`
                    INSERT INTO studio_projects (user_id, title, aspect_ratio, duration, project_data, thumbnail)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                `, [user.id, title || 'Dự án mới', aspect_ratio || '9:16', duration || 15, JSON.stringify(project_data), thumbnail || null]);
                projectId = insertRes[0]?.id;
            }

            res.json({
                success: true,
                project_id: projectId,
                message: 'Đã lưu dự án vào tài khoản thành công!'
            });
        } catch (err) {
            console.error('saveProject error:', err);
            res.status(500).json({ success: false, message: 'Lỗi lưu dự án: ' + err.message });
        }
    },

    // 6. Get user saved projects
    getUserProjects: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) {
                return res.json({ success: true, projects: [] });
            }

            const [projects] = await db.query(`
                SELECT id, title, aspect_ratio, duration, thumbnail, updated_at, created_at
                FROM studio_projects
                WHERE user_id = $1
                ORDER BY updated_at DESC
            `, [user.id]);

            res.json({ success: true, projects });
        } catch (err) {
            console.error('getUserProjects error:', err);
            res.status(500).json({ success: false, message: 'Lỗi tải danh sách dự án: ' + err.message });
        }
    },

    // 7. Load user project by ID
    loadProject: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            const { id } = req.params;

            const [rows] = await db.query(
                'SELECT * FROM studio_projects WHERE id = $1 AND user_id = $2 LIMIT 1',
                [id, user ? user.id : '']
            );

            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Không tìm thấy dự án' });
            }

            res.json({ success: true, project: rows[0] });
        } catch (err) {
            console.error('loadProject error:', err);
            res.status(500).json({ success: false, message: 'Lỗi mở dự án: ' + err.message });
        }
    },

    // 8. Delete user project
    deleteProject: async (req, res) => {
        try {
            const user = req.user || req.session?.user;
            if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

            const { id } = req.body;
            await db.query('DELETE FROM studio_projects WHERE id = $1 AND user_id = $2', [id, user.id]);
            res.json({ success: true, message: 'Đã xóa dự án' });
        } catch (err) {
            console.error('deleteProject error:', err);
            res.status(500).json({ success: false, message: 'Lỗi xóa dự án: ' + err.message });
        }
    },

    // 9. Admin: List all templates for admin management
    adminListTemplates: async (req, res) => {
        try {
            const [templates] = await db.query('SELECT * FROM video_templates ORDER BY id DESC');
            res.render('admin/studio_templates', {
                title: 'Quản lý Mẫu Video - Bình Lợi Studio',
                user: req.user,
                templates
            });
        } catch (err) {
            console.error('adminListTemplates error:', err);
            res.status(500).send('Lỗi máy chủ: ' + err.message);
        }
    },

    // 10. Admin: Save (create or update) template
    adminSaveTemplate: async (req, res) => {
        try {
            const { id, template_id, title, category, badge, aspect_ratio, duration, slots_count, thumbnail, audio_url, audio_title, config, is_published } = req.body;

            const publishedBool = is_published === 'true' || is_published === true || is_published === 1 || is_published === '1';

            if (id) {
                await db.query(`
                    UPDATE video_templates SET
                        template_id = $1, title = $2, category = $3, badge = $4,
                        aspect_ratio = $5, duration = $6, slots_count = $7,
                        thumbnail = $8, audio_url = $9, audio_title = $10,
                        config = $11, is_published = $12, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $13
                `, [template_id, title, category, badge, aspect_ratio, duration, slots_count, thumbnail, audio_url, audio_title, typeof config === 'object' ? JSON.stringify(config) : config, publishedBool, id]);
            } else {
                await db.query(`
                    INSERT INTO video_templates (template_id, title, category, badge, aspect_ratio, duration, slots_count, thumbnail, audio_url, audio_title, config, is_published)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                `, [template_id, title, category, badge, aspect_ratio, duration, slots_count, thumbnail, audio_url, audio_title, typeof config === 'object' ? JSON.stringify(config) : config, publishedBool]);
            }

            res.json({ success: true, message: 'Đã lưu mẫu video thành công!' });
        } catch (err) {
            console.error('adminSaveTemplate error:', err);
            res.status(500).json({ success: false, message: 'Lỗi lưu mẫu: ' + err.message });
        }
    },

    // 11. Admin: Delete template
    adminDeleteTemplate: async (req, res) => {
        try {
            const { id } = req.body;
            await db.query('DELETE FROM video_templates WHERE id = $1', [id]);
            res.json({ success: true, message: 'Đã xóa mẫu video!' });
        } catch (err) {
            console.error('adminDeleteTemplate error:', err);
            res.status(500).json({ success: false, message: 'Lỗi xóa mẫu: ' + err.message });
        }
    },

    // 12. Admin: Toggle publish status
    adminToggleTemplate: async (req, res) => {
        try {
            const { id } = req.body;
            await db.query('UPDATE video_templates SET is_published = NOT is_published, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [id]);
            res.json({ success: true, message: 'Đã cập nhật trạng thái hiển thị!' });
        } catch (err) {
            console.error('adminToggleTemplate error:', err);
            res.status(500).json({ success: false, message: 'Lỗi cập nhật: ' + err.message });
        }
    }
};

module.exports = StudioApiController;
