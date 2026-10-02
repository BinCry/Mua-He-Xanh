const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const db = require('../src/core/database');

async function buildExcelReport() {
    console.log('🚀 Đang khởi tạo báo cáo Excel đa tầng cho Bình Lợi Healing...');
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Bình Lợi Studio & Healing System';
    workbook.lastModifiedBy = 'Admin Bình Lợi';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Style helpers
    const brandRed = '922724';
    const darkNavy = '1E293B';
    const headerFont = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
    const headerFill = (argbColor) => ({
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: argbColor }
    });
    const thinBorder = {
        top: { style: 'thin', color: { argb: 'CBD5E1' } },
        left: { style: 'thin', color: { argb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
        right: { style: 'thin', color: { argb: 'CBD5E1' } }
    };
    const zebraFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'F8FAFC' }
    };

    function applyHeaderStyle(row, color = brandRed) {
        row.height = 26;
        row.eachCell((cell) => {
            cell.font = headerFont;
            cell.fill = headerFill(color);
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = thinBorder;
        });
    }

    function applyDataRowsStyle(sheet, startRow = 2) {
        for (let r = startRow; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const isEven = r % 2 === 0;
            row.eachCell((cell) => {
                cell.font = { name: 'Arial', size: 10 };
                cell.border = thinBorder;
                if (!cell.alignment) {
                    cell.alignment = { vertical: 'middle' };
                } else if (!cell.alignment.vertical) {
                    cell.alignment.vertical = 'middle';
                }
                if (isEven && !cell.fill) {
                    cell.fill = zebraFill;
                }
            });
        }
    }

    function autoFitColumns(sheet) {
        sheet.columns.forEach((col) => {
            let maxLen = 10;
            col.eachCell({ includeEmpty: true }, (cell) => {
                const val = cell.value ? cell.value.toString() : '';
                if (val.length > maxLen) {
                    maxLen = Math.min(val.length + 4, 60);
                }
            });
            col.width = Math.max(maxLen, 12);
        });
    }

    try {
        // ==========================================
        // SHEET 1: 📊 TỔNG QUAN & KPI HỆ THỐNG
        // ==========================================
        const wsOverview = workbook.addWorksheet('📊 Tổng quan KPI');
        wsOverview.views = [{ showGridLines: true }];

        // Title banner
        wsOverview.mergeCells('A1:D1');
        const titleCell = wsOverview.getCell('A1');
        titleCell.value = 'BÁO CÁO TOÀN DIỆN SỐ LIỆU HỆ THỐNG BÌNH LỢI HEALING';
        titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFF' } };
        titleCell.fill = headerFill(brandRed);
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
        wsOverview.getRow(1).height = 36;

        wsOverview.getCell('A2').value = `Thời gian xuất: ${new Date().toLocaleString('vi-VN')} | Động cơ: PostgreSQL (Supabase)`;
        wsOverview.getCell('A2').font = { name: 'Arial', size: 10, italic: true, color: { argb: '64748B' } };
        wsOverview.mergeCells('A2:D2');
        wsOverview.getRow(2).height = 20;

        // Fetch row counts
        const tables = [
            { name: 'Lượt ghi nhận hành vi (Analytics)', table: 'analytics' },
            { name: 'Tổng số phiên truy cập (Sessions)', table: 'user_sessions' },
            { name: 'Tài khoản người dùng (Users)', table: 'users' },
            { name: 'Điểm đến du lịch (Destinations)', table: 'destinations' },
            { name: 'Lượt Check-in du khách (Check-ins)', table: 'check_ins' },
            { name: 'Hành trình cá nhân hóa (Journeys)', table: 'journeys' },
            { name: 'Bài đánh giá cộng đồng (Reviews)', table: 'reviews' },
            { name: 'Bình luận đánh giá (Comments)', table: 'review_comments' },
            { name: 'Workshop & Trải nghiệm làng nghề', table: 'workshops' },
            { name: 'Đơn đăng ký Workshop (Bookings)', table: 'workshop_bookings' },
            { name: 'Tin nhắn tương tác (Messages)', table: 'messages' },
            { name: 'Mẫu video ngắn (Bình Lợi Studio)', table: 'video_templates' },
            { name: 'Không gian âm thanh thư giãn (Soundscapes)', table: 'soundscapes' }
        ];

        wsOverview.getCell('A4').value = 'BẢNG THỐNG KÊ CÁC CHỈ SỐ CỐT LÕI (CORE METRICS)';
        wsOverview.getCell('A4').font = { name: 'Arial', size: 11, bold: true, color: { argb: '1E293B' } };
        wsOverview.getRow(4).height = 22;

        wsOverview.getRow(5).values = ['STT', 'Hạng mục dữ liệu', 'Số lượng ghi nhận', 'Ghi chú vận hành'];
        applyHeaderStyle(wsOverview.getRow(5), darkNavy);

        let curRow = 6;
        let stt = 1;
        for (const item of tables) {
            let count = 0;
            try {
                const [res] = await db.query(`SELECT COUNT(*) as cnt FROM ${item.table}`);
                count = parseInt(res[0]?.cnt || 0, 10);
            } catch (e) {
                count = 0;
            }
            const r = wsOverview.getRow(curRow++);
            r.values = [stt++, item.name, count, 'Đang hoạt động trên hệ thống'];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(3).numFmt = '#,##0';
            r.getCell(3).font = { bold: true };
            r.height = 20;
        }

        // Users by role summary
        curRow++;
        wsOverview.getCell(`A${curRow}`).value = 'PHÂN LOẠI TÀI KHOẢN NGƯỜI DÙNG';
        wsOverview.getCell(`A${curRow}`).font = { name: 'Arial', size: 11, bold: true, color: { argb: '1E293B' } };
        curRow++;
        wsOverview.getRow(curRow).values = ['STT', 'Vai trò (Role)', 'Số lượng tài khoản', 'Tỷ lệ %'];
        applyHeaderStyle(wsOverview.getRow(curRow), '475569');

        const [usersRole] = await db.query('SELECT role, COUNT(*) as count FROM users GROUP BY role ORDER BY count DESC');
        const [totalUsersRow] = await db.query('SELECT COUNT(*) as total FROM users');
        const totalUsers = parseInt(totalUsersRow[0]?.total || 1, 10);

        curRow++;
        let roleStt = 1;
        for (const u of usersRole) {
            const r = wsOverview.getRow(curRow++);
            const cnt = parseInt(u.count, 10);
            const roleName = u.role === 'admin' ? 'Quản trị viên (Admin)' : (u.role === 'manager' ? 'Đối tác quản lý (Manager)' : 'Khách du lịch (Tourist)');
            r.values = [roleStt++, roleName, cnt, cnt / totalUsers];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(3).numFmt = '#,##0';
            r.getCell(4).numFmt = '0.0%';
            r.height = 20;
        }

        applyDataRowsStyle(wsOverview, 6);
        autoFitColumns(wsOverview);
        wsOverview.getColumn(1).width = 8;
        wsOverview.getColumn(2).width = 42;
        wsOverview.getColumn(3).width = 24;
        wsOverview.getColumn(4).width = 30;

        // ==========================================
        // SHEET 2: 📈 LƯỢNG TRUY CẬP THEO NGÀY (45 NGÀY)
        // ==========================================
        const wsDaily = workbook.addWorksheet('📈 Truy cập theo ngày');
        wsDaily.views = [{ showGridLines: true }];
        wsDaily.getRow(1).values = ['Ngày', 'Tổng số sự kiện (Events)', 'Số phiên truy cập (Sessions)', 'Số IP duy nhất (Unique IPs)', 'TB sự kiện / Phiên'];
        applyHeaderStyle(wsDaily.getRow(1), brandRed);

        const [dailyAnalytics] = await db.query(`
            SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as day, 
                   COUNT(*) as total_events,
                   COUNT(DISTINCT session_id) as unique_sessions,
                   COUNT(DISTINCT ip_address) as unique_ips
            FROM analytics 
            GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
            ORDER BY day DESC
            LIMIT 45
        `);

        dailyAnalytics.forEach((d, idx) => {
            const r = wsDaily.getRow(idx + 2);
            const ev = parseInt(d.total_events, 10);
            const sess = parseInt(d.unique_sessions, 10);
            const ips = parseInt(d.unique_ips, 10);
            const avgPerSess = sess > 0 ? (ev / sess) : 0;
            r.values = [d.day, ev, sess, ips, avgPerSess];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(2).numFmt = '#,##0';
            r.getCell(3).numFmt = '#,##0';
            r.getCell(4).numFmt = '#,##0';
            r.getCell(5).numFmt = '0.0';
            r.height = 20;
        });
        applyDataRowsStyle(wsDaily, 2);
        autoFitColumns(wsDaily);

        // ==========================================
        // SHEET 3: 🌐 TOP TRANG XEM NHIỀU NHẤT
        // ==========================================
        const wsTopPages = workbook.addWorksheet('🌐 Trang xem nhiều nhất');
        wsTopPages.views = [{ showGridLines: true }];
        wsTopPages.getRow(1).values = ['Thứ hạng', 'Đường dẫn trang (URL)', 'Lượt xem (Views)', 'Mô tả tính năng'];
        applyHeaderStyle(wsTopPages.getRow(1), darkNavy);

        const [topPages] = await db.query(`
            SELECT page_url, COUNT(*) as views 
            FROM analytics 
            WHERE page_url IS NOT NULL 
              AND page_url NOT LIKE '/@%' 
              AND page_url NOT LIKE '%bak%' 
              AND page_url NOT LIKE '%.env%'
              AND page_url NOT LIKE '%terraform%'
            GROUP BY page_url 
            ORDER BY views DESC 
            LIMIT 40
        `);

        topPages.forEach((p, idx) => {
            const r = wsTopPages.getRow(idx + 2);
            let desc = 'Trang nội dung';
            if (p.page_url === '/') desc = 'Trang chủ Bình Lợi Healing';
            else if (p.page_url.startsWith('/explore') || p.page_url.startsWith('/kham-pha')) desc = 'Khám phá điểm đến';
            else if (p.page_url.startsWith('/journey') || p.page_url.startsWith('/hanh-trinh')) desc = 'Lên kế hoạch hành trình';
            else if (p.page_url.startsWith('/reviews/video-editor')) desc = 'Bình Lợi Studio (Tạo video ngắn)';
            else if (p.page_url.startsWith('/reviews')) desc = 'Cộng đồng & Đánh giá';
            else if (p.page_url.startsWith('/map')) desc = 'Bản đồ số du lịch';
            else if (p.page_url.startsWith('/checkin')) desc = 'Check-in nhận điểm thưởng';
            else if (p.page_url.startsWith('/shop') || p.page_url.startsWith('/workshops')) desc = 'Trải nghiệm & Làng nghề';

            r.values = [idx + 1, p.page_url, parseInt(p.views, 10), desc];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(3).numFmt = '#,##0';
            r.getCell(3).font = { bold: true };
            r.height = 20;
        });
        applyDataRowsStyle(wsTopPages, 2);
        autoFitColumns(wsTopPages);

        // ==========================================
        // SHEET 4: 📍 DANH SÁCH ĐIỂM ĐẾN (DESTINATIONS)
        // ==========================================
        const wsDest = workbook.addWorksheet('📍 Điểm đến Bình Lợi');
        wsDest.views = [{ showGridLines: true }];
        wsDest.getRow(1).values = [
            'ID', 'Tên điểm đến', 'Slug', 'Thể loại', 'Chi phí tham quan',
            'Giờ mở cửa', 'Điểm thưởng', 'Lượt Check-in', 'Số đánh giá', 'Đánh giá TB', 'Trạng thái'
        ];
        applyHeaderStyle(wsDest.getRow(1), brandRed);

        const [destinations] = await db.query(`
            SELECT d.id, d.name, d.slug, d.type, d.cost, d.open_hours, d.points, d.is_active,
                   COUNT(DISTINCT c.id) as checkin_count,
                   COUNT(DISTINCT r.id) as review_count,
                   AVG(r.rating) as avg_rating
            FROM destinations d
            LEFT JOIN check_ins c ON c.destination_id = d.id
            LEFT JOIN reviews r ON r.destination_id = d.id
            GROUP BY d.id, d.name, d.slug, d.type, d.cost, d.open_hours, d.points, d.is_active
            ORDER BY checkin_count DESC, d.name ASC
        `);

        destinations.forEach((d, idx) => {
            const r = wsDest.getRow(idx + 2);
            r.values = [
                d.id,
                d.name,
                d.slug,
                d.type || 'Tham quan',
                d.cost || 'Miễn phí',
                d.open_hours || '07:00 - 18:00',
                d.points || 10,
                parseInt(d.checkin_count || 0, 10),
                parseInt(d.review_count || 0, 10),
                d.avg_rating ? parseFloat(d.avg_rating) : null,
                d.is_active ? 'Đang hoạt động' : 'Tạm dừng'
            ];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(7).numFmt = '#,##0';
            r.getCell(8).numFmt = '#,##0';
            r.getCell(9).numFmt = '#,##0';
            r.getCell(10).numFmt = '0.0 ⭐';
            r.getCell(11).alignment = { horizontal: 'center' };
            r.height = 20;
        });
        applyDataRowsStyle(wsDest, 2);
        autoFitColumns(wsDest);

        // ==========================================
        // SHEET 5: 💬 ĐÁNH GIÁ & CỘNG ĐỒNG (REVIEWS)
        // ==========================================
        const wsReviews = workbook.addWorksheet('💬 Đánh giá cộng đồng');
        wsReviews.views = [{ showGridLines: true }];
        wsReviews.getRow(1).values = [
            'ID', 'Tên tác giả', 'Email', 'Điểm đến', 'Số sao (Rating)', 'Nội dung nhận xét',
            'Lượt thích (Likes)', 'Số bình luận', 'Ngày đăng'
        ];
        applyHeaderStyle(wsReviews.getRow(1), darkNavy);

        const [allReviews] = await db.query(`
            SELECT r.id, r.user_id, u.full_name as author_name, u.email as author_email,
                   d.name as destination_name, r.rating, r.content,
                   r.likes_count, r.comments_count, r.created_at
            FROM reviews r
            LEFT JOIN users u ON r.user_id = u.id
            LEFT JOIN destinations d ON r.destination_id = d.id
            ORDER BY r.created_at DESC
        `);

        allReviews.forEach((rv, idx) => {
            const r = wsReviews.getRow(idx + 2);
            r.values = [
                rv.id,
                rv.author_name || 'Khách ẩn danh',
                rv.author_email || '',
                rv.destination_name || 'Bình Lợi',
                rv.rating,
                rv.content || '',
                parseInt(rv.likes_count || 0, 10),
                parseInt(rv.comments_count || 0, 10),
                rv.created_at ? new Date(rv.created_at).toLocaleString('vi-VN') : ''
            ];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(5).numFmt = '0 ⭐';
            r.getCell(7).numFmt = '#,##0';
            r.getCell(8).numFmt = '#,##0';
            r.height = 20;
        });
        applyDataRowsStyle(wsReviews, 2);
        autoFitColumns(wsReviews);

        // ==========================================
        // SHEET 6: 📱 DỮ LIỆU CHECK-IN (CHECK-INS)
        // ==========================================
        const wsCheckins = workbook.addWorksheet('📱 Lịch sử Check-in');
        wsCheckins.views = [{ showGridLines: true }];
        wsCheckins.getRow(1).values = [
            'Mã Check-in', 'Tên người dùng', 'Điểm đến check-in', 'Phương thức',
            'Khoảng cách (m)', 'Điểm thưởng nhận', 'Thời gian Check-in'
        ];
        applyHeaderStyle(wsCheckins.getRow(1), brandRed);

        const [checkinsData] = await db.query(`
            SELECT c.id, u.full_name as user_name, d.name as destination_name,
                   c.checkin_method, c.distance_meter, c.points_earned, c.created_at
            FROM check_ins c
            LEFT JOIN users u ON c.user_id = u.id
            LEFT JOIN destinations d ON c.destination_id = d.id
            ORDER BY c.created_at DESC
            LIMIT 250
        `);

        checkinsData.forEach((ck, idx) => {
            const r = wsCheckins.getRow(idx + 2);
            r.values = [
                ck.id,
                ck.user_name || 'Khách du lịch',
                ck.destination_name || 'Điểm đến Bình Lợi',
                ck.checkin_method === 'qr' ? 'Mã QR Code' : 'Định vị GPS',
                ck.distance_meter ? Math.round(ck.distance_meter) : 0,
                ck.points_earned || 10,
                ck.created_at ? new Date(ck.created_at).toLocaleString('vi-VN') : ''
            ];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(4).alignment = { horizontal: 'center' };
            r.getCell(5).numFmt = '#,##0 m';
            r.getCell(6).numFmt = '+#,##0 điểm';
            r.height = 20;
        });
        applyDataRowsStyle(wsCheckins, 2);
        autoFitColumns(wsCheckins);

        // ==========================================
        // SHEET 7: 🗺️ HÀNH TRÌNH DU KHÁCH (JOURNEYS)
        // ==========================================
        const wsJourneys = workbook.addWorksheet('🗺️ Hành trình du khách');
        wsJourneys.views = [{ showGridLines: true }];
        wsJourneys.getRow(1).values = [
            'ID Hành trình', 'Mục đích / Tâm trạng (Mood)', 'Thời lượng (giờ)', 'Sở thích (Interests)',
            'Tổng cự ly (km)', 'Tổng phút', 'Trạng thái', 'Ngày khởi tạo'
        ];
        applyHeaderStyle(wsJourneys.getRow(1), darkNavy);

        const [journeysData] = await db.query(`
            SELECT id, mood, duration, interests, total_km, total_minutes, status, created_at
            FROM journeys
            ORDER BY created_at DESC
            LIMIT 150
        `);

        journeysData.forEach((j, idx) => {
            const r = wsJourneys.getRow(idx + 2);
            r.values = [
                j.id,
                j.mood || 'Thư giãn an yên',
                j.duration || 'Nửa ngày',
                j.interests || 'Vườn mai, Đầm sen, Ẩm thực',
                j.total_km ? parseFloat(j.total_km) : 0,
                j.total_minutes || 0,
                j.status === 'completed' ? 'Hoàn thành' : 'Đang thực hiện',
                j.created_at ? new Date(j.created_at).toLocaleString('vi-VN') : ''
            ];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(5).numFmt = '0.0 km';
            r.getCell(6).numFmt = '#,##0 phút';
            r.getCell(7).alignment = { horizontal: 'center' };
            r.height = 20;
        });
        applyDataRowsStyle(wsJourneys, 2);
        autoFitColumns(wsJourneys);

        // ==========================================
        // SHEET 8: 🛠️ WORKSHOPS & TRẢI NGHIỆM
        // ==========================================
        const wsWorkshops = workbook.addWorksheet('🛠️ Workshops & Làng nghề');
        wsWorkshops.views = [{ showGridLines: true }];
        wsWorkshops.getRow(1).values = [
            'ID', 'Tên Workshop / Sản phẩm', 'Điểm đến tổ chức', 'Thể loại',
            'Đơn giá (VNĐ)', 'Số người tối đa', 'Thời lượng', 'Lượt đặt chỗ', 'Trạng thái'
        ];
        applyHeaderStyle(wsWorkshops.getRow(1), brandRed);

        const [workshopsData] = await db.query(`
            SELECT w.id, w.title, d.name as dest_name, w.type, w.price,
                   w.max_participants, w.duration, w.is_active,
                   COUNT(b.id) as total_bookings
            FROM workshops w
            LEFT JOIN destinations d ON w.destination_id = d.id
            LEFT JOIN workshop_bookings b ON b.workshop_id = w.id
            GROUP BY w.id, w.title, d.name, w.type, w.price, w.max_participants, w.duration, w.is_active
            ORDER BY total_bookings DESC, w.title ASC
        `);

        workshopsData.forEach((w, idx) => {
            const r = wsWorkshops.getRow(idx + 2);
            r.values = [
                w.id,
                w.title,
                w.dest_name || 'Làng mai Bình Lợi',
                w.type || 'Trải nghiệm',
                parseFloat(w.price || 0),
                w.max_participants || 20,
                w.duration || '90 phút',
                parseInt(w.total_bookings || 0, 10),
                w.is_active ? 'Mở đón khách' : 'Tạm dừng'
            ];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(5).numFmt = '#,##0 "₫"';
            r.getCell(6).numFmt = '#,##0 người';
            r.getCell(8).numFmt = '#,##0';
            r.height = 20;
        });
        applyDataRowsStyle(wsWorkshops, 2);
        autoFitColumns(wsWorkshops);

        // ==========================================
        // SHEET 9: 🎬 BÌNH LỢI STUDIO (TEMPLATES)
        // ==========================================
        const wsStudio = workbook.addWorksheet('🎬 Mẫu Bình Lợi Studio');
        wsStudio.views = [{ showGridLines: true }];
        wsStudio.getRow(1).values = [
            'ID', 'Mã Template', 'Tên Mẫu Video', 'Danh mục', 'Nhãn hiển thị',
            'Tỷ lệ khung hình', 'Thời lượng (giây)', 'Số cảnh (Slots)', 'Nhạc nền mẫu', 'Trạng thái'
        ];
        applyHeaderStyle(wsStudio.getRow(1), darkNavy);

        const [templatesData] = await db.query(`
            SELECT id, template_id, title, category, badge, aspect_ratio,
                   duration, slots_count, audio_title, is_published
            FROM video_templates
            ORDER BY id ASC
        `);

        templatesData.forEach((t, idx) => {
            const r = wsStudio.getRow(idx + 2);
            r.values = [
                t.id,
                t.template_id,
                t.title,
                t.category,
                t.badge,
                t.aspect_ratio,
                t.duration,
                t.slots_count,
                t.audio_title || 'Mặc định',
                t.is_published ? 'Đã phát hành' : 'Bản nháp'
            ];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(6).alignment = { horizontal: 'center' };
            r.getCell(7).numFmt = '#,##0"s"';
            r.getCell(8).numFmt = '#,##0 cảnh';
            r.getCell(10).alignment = { horizontal: 'center' };
            r.height = 20;
        });
        applyDataRowsStyle(wsStudio, 2);
        autoFitColumns(wsStudio);

        // ==========================================
        // SHEET 10: 👥 DANH SÁCH TÀI KHOẢN (USERS)
        // ==========================================
        const wsUsers = workbook.addWorksheet('👥 Tài khoản người dùng');
        wsUsers.views = [{ showGridLines: true }];
        wsUsers.getRow(1).values = [
            'ID', 'Họ và tên', 'Email', 'Số điện thoại', 'Vai trò', 'Điểm tích lũy', 'Ngày đăng ký'
        ];
        applyHeaderStyle(wsUsers.getRow(1), '334155');

        const [usersData] = await db.query(`
            SELECT id, full_name, email, phone, role, total_points, created_at
            FROM users
            ORDER BY created_at DESC
        `);

        usersData.forEach((u, idx) => {
            const r = wsUsers.getRow(idx + 2);
            r.values = [
                u.id,
                u.full_name || 'Người dùng',
                u.email || '',
                u.phone || '',
                u.role === 'admin' ? 'Quản trị viên (Admin)' : (u.role === 'manager' ? 'Đối tác quản lý (Manager)' : 'Khách du lịch (Tourist)'),
                u.total_points || 0,
                u.created_at ? new Date(u.created_at).toLocaleString('vi-VN') : ''
            ];
            r.getCell(1).alignment = { horizontal: 'center' };
            r.getCell(5).alignment = { horizontal: 'center' };
            r.getCell(6).numFmt = '#,##0 điểm';
            r.height = 20;
        });
        applyDataRowsStyle(wsUsers, 2);
        autoFitColumns(wsUsers);

        // Ghi file Excel ra thư mục exports
        const excelPath = path.join(exportDir, 'BAO_CAO_SO_LIEU_BINH_LOI_HEALING.xlsx');
        await workbook.xlsx.writeFile(excelPath);
        console.log(`✅ File Excel đã được tạo thành công tại: ${excelPath}`);

        console.log('🔒 Báo cáo chỉ được giữ trong thư mục exports riêng tư; không sao chép ra ổ C hoặc public web.');

        console.log('--- HOÀN TẤT BÁO CÁO EXCEL THÀNH CÔNG ---');
        process.exit(0);
    } catch (err) {
        console.error('❌ Lỗi khi tạo file Excel:', err);
        process.exit(1);
    }
}

buildExcelReport();
