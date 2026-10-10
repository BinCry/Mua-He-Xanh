const Festival = require('../models/Festival');
const cache = require('../core/cache');
const { randomBytes, randomUUID } = require('crypto');

class FestivalController {
    async index(req, res) {
        try {
            let festivals = cache.get('festivals:list');
            if (!festivals) {
                festivals = await Festival.findAll();
                cache.set('festivals:list', festivals, 60);
            }
            res.render('festivals/index', {
                title: 'Lễ hội & Sự kiện Bình Lợi',
                festivals,
                featuredFestival: festivals[0] || null
            });
        } catch (error) {
            console.error("Festival index error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    async book(req, res) {
        try {
            const { festivalId, fullName, phone, tickets } = req.body;
            const user = req.user || req.session?.user || null;
            const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
            const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
            const ticketCount = Number(tickets);
            const idempotencyKey = String(req.get('Idempotency-Key') || req.body.idempotency_key || '').trim();

            if (typeof festivalId !== 'string' && typeof festivalId !== 'number') {
                return res.status(400).json({ success: false, message: 'Sự kiện không hợp lệ.' });
            }
            if (!cleanName || cleanName.length > 255 || !/^\+?[0-9][0-9 ()-]{7,18}$/.test(cleanPhone)) {
                return res.status(400).json({ success: false, message: 'Vui lòng nhập họ tên và số điện thoại hợp lệ.' });
            }
            if (!Number.isInteger(ticketCount) || ticketCount < 1 || ticketCount > 20) {
                return res.status(400).json({ success: false, message: 'Số lượng đăng ký phải từ 1 đến 20 người.' });
            }
            if (!/^[A-Za-z0-9_-]{16,128}$/.test(idempotencyKey)) {
                return res.status(400).json({ success: false, message: 'Thiếu mã đăng ký chống trùng. Vui lòng tải lại trang.' });
            }

            const [festivals] = await Festival.db.query(
                'SELECT id FROM festivals WHERE id = $1 AND (date IS NULL OR date >= CURRENT_DATE) LIMIT 1',
                [String(festivalId)]
            );
            if (festivals.length === 0) {
                return res.status(404).json({ success: false, message: 'Sự kiện không tồn tại hoặc đã kết thúc.' });
            }

            const booking = await Festival.createBooking({
                id: randomUUID(),
                user_id: user?.id || null,
                festival_id: String(festivalId),
                full_name: cleanName,
                phone: cleanPhone,
                tickets: ticketCount,
                status: 'pending',
                reference_code: randomBytes(8).toString('hex').toUpperCase(),
                idempotency_key: idempotencyKey
            });

            res.json({
                success: true,
                reference: booking.reference_code,
                message: `Đã nhận yêu cầu đăng ký ${ticketCount} người. Mã tham chiếu: ${booking.reference_code}. Đây chưa phải vé xác nhận; ban tổ chức sẽ liên hệ qua số điện thoại đã cung cấp.`
            });
        } catch (error) {
            console.error(`[${req.requestId || 'untracked'}] Festival booking error:`, error);
            if (error.code === 'IDEMPOTENCY_CONFLICT') {
                return res.status(409).json({ success: false, message: 'Mã đăng ký đã được dùng cho thông tin khác. Vui lòng tải lại trang.' });
            }
            res.status(500).json({ success: false, message: 'Chưa thể tiếp nhận đăng ký. Vui lòng thử lại sau.' });
        }
    }
}

module.exports = new FestivalController();
