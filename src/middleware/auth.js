/**
 * Middleware to check if user is authenticated
 */
exports.ensureAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect('/auth/login?error=Vui lòng đăng nhập để thực hiện thao tác này');
};

/**
 * Middleware to check if user has manager/admin role
 */
exports.ensureManager = (req, res, next) => {
    const user = req.session.user;
    if (user && (user.role === 'manager' || user.role === 'admin')) {
        return next();
    }
    res.status(403).render('errors/403', { 
        title: '403 - Truy cập bị từ chối',
        message: 'Bạn không có quyền truy cập vào khu vực quản lý này.' 
    });
};

/**
 * Middleware to check if visitor is restricted from editing
 */
exports.restrictToManagers = (req, res, next) => {
    const user = req.session.user;
    if (!user || (user.role !== 'manager' && user.role !== 'admin')) {
        return res.status(403).json({ 
            success: false, 
            message: 'Chỉ quản lý mới có quyền thực hiện thao tác chỉnh sửa này.' 
        });
    }
    next();
};
