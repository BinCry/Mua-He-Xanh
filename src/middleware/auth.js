/**
 * Hệ thống Phân quyền Bình Lợi Healing
 * Tham khảo mô hình RBAC từ dự án Relioo (Nhóm 9)
 * 
 * Bảng roles:
 *   1 = admin     (Quản trị viên hệ thống - Toàn quyền)
 *   2 = manager   (Quản lý địa điểm)
 *   3 = user      (Du khách)
 *   4 = guest     (Khách vãng lai)
 */

const ROLES = {
    ADMIN: 1,
    MANAGER: 2,
    USER: 3,
    GUEST: 4
};

const ROLE_NAMES = {
    1: 'admin',
    2: 'manager',
    3: 'user',
    4: 'guest'
};

/**
 * Kiểm tra đã đăng nhập chưa (Tương tự checkAuth() trong Relioo)
 */
exports.ensureAuthenticated = (req, res, next) => {
    if (req.user || req.session.user) {
        return next();
    }
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để thực hiện thao tác này.' });
    }
    res.redirect('/auth/login?error=Vui lòng đăng nhập để thực hiện thao tác này');
};

/**
 * Kiểm tra quyền Admin (Tương tự checkSuperAdminAccess() trong Relioo)
 * Admin có toàn quyền quản lý hệ thống
 */
exports.ensureAdmin = (req, res, next) => {
    const user = req.user || req.session.user;
    if (user && (user.role === 'admin' || user.role_id === ROLES.ADMIN)) {
        return next();
    }
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối: Chỉ Quản trị viên mới được phép thực hiện thao tác này.' });
    }
    res.status(403).render('errors/403', {
        title: '403 - Truy cập bị từ chối',
        message: 'Chỉ Quản trị viên mới có quyền truy cập khu vực này.'
    });
};

/**
 * Kiểm tra quyền Manager hoặc Admin (Tương tự checkAdminAccess() trong Relioo)
 * Manager quản lý địa điểm được gán, Admin có quyền truy cập tất cả
 */
exports.ensureManager = (req, res, next) => {
    const user = req.user || req.session.user;
    if (user && (
        user.role === 'manager' || user.role === 'admin' ||
        user.role_id === ROLES.MANAGER || user.role_id === ROLES.ADMIN
    )) {
        return next();
    }
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối: Bạn không có quyền thực hiện hành động quản lý này.' });
    }
    res.status(403).render('errors/403', {
        title: '403 - Truy cập bị từ chối',
        message: 'Bạn không có quyền truy cập vào khu vực quản lý này.'
    });
};

/**
 * Kiểm tra quyền du khách (Tourist)
 */
exports.ensureTourist = (req, res, next) => {
    const user = req.user || req.session.user;
    if (user && (user.role === 'user' || user.role_id === ROLES.USER)) {
        return next();
    }
    if (user && (user.role === 'admin' || user.role_id === ROLES.ADMIN)) {
        return res.redirect('/admin');
    }
    if (user && (user.role === 'manager' || user.role_id === ROLES.MANAGER)) {
        return res.redirect('/manager');
    }
    if (req.originalUrl && req.originalUrl.startsWith('/api')) {
        return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập bằng tài khoản du khách.' });
    }
    res.redirect('/auth/login?error=Vui lòng đăng nhập bằng tài khoản du khách');
};

/**
 * API-level middleware: Chặn chỉnh sửa nếu không phải Manager/Admin
 * Trả về JSON thay vì render HTML (dùng cho AJAX calls)
 */
exports.restrictToManagers = (req, res, next) => {
    const user = req.user || req.session.user;
    if (!user || (
        user.role !== 'manager' && user.role !== 'admin' &&
        user.role_id !== ROLES.MANAGER && user.role_id !== ROLES.ADMIN
    )) {
        return res.status(403).json({
            success: false,
            message: 'Chỉ quản lý mới có quyền thực hiện thao tác chỉnh sửa này.'
        });
    }
    next();
};

/**
 * Middleware linh hoạt: Cho phép chỉ định danh sách role được phép
 * Ví dụ: requireRole(ROLES.ADMIN, ROLES.MANAGER)
 */
exports.requireRole = (...allowedRoleIds) => {
    return (req, res, next) => {
        const user = req.user || req.session.user;
        if (!user) {
            return res.redirect('/auth/login?error=Vui lòng đăng nhập');
        }

        const userRoleId = user.role_id || (user.role === 'admin' ? 1 : user.role === 'manager' ? 2 : 3);

        if (allowedRoleIds.includes(userRoleId)) {
            return next();
        }

        res.status(403).render('errors/403', {
            title: '403 - Truy cập bị từ chối',
            message: 'Bạn không có quyền thực hiện hành động này.'
        });
    };
};

// Export constants
exports.ROLES = ROLES;
exports.ROLE_NAMES = ROLE_NAMES;
