const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');
const db = require('../core/database');

const AuthController = {
    
    loginPage: (req, res) => {
        const config = require('../config/env');
        const rawError = req.query.error || null;
        
        const ERROR_MAP = {
            'journey': 'Vui lòng đăng nhập để xem hành trình của bạn',
            'auth_required': 'Vui lòng đăng nhập để thực hiện thao tác này',
            'tourist_required': 'Vui lòng đăng nhập bằng tài khoản du khách',
            'invalid_credentials': 'Sai email hoặc mật khẩu',
            'fill_fields': 'Vui lòng điền đầy đủ thông tin',
            'invalid_phone': 'Số điện thoại không hợp lệ (10-11 chữ số)',
            'phone_exists': 'Số điện thoại này đã được sử dụng',
            'no_manager_dest': 'Bạn không có quyền quản lý địa điểm nào',
            'google_config': 'Lỗi cấu hình Google: Thiếu Client ID trên Server',
            'facebook_config': 'Lỗi cấu hình Facebook: Thiếu App ID trên Server',
            'reg_system_error': 'Lỗi hệ thống khi đăng ký',
            'session_error': 'Lỗi tạo phiên đăng nhập'
        };

        const errorMessage = rawError ? (ERROR_MAP[rawError] || decodeURIComponent(rawError)) : null;

        res.render('auth/login', {
            title: 'Đăng nhập - Bình Lợi Healing',
            error: errorMessage,
            facebookConfigured: true
        });
    },

    adminLoginPage: (req, res) => {
        const rawError = req.query.error || null;
        const ERROR_MAP = {
            'invalid_credentials': 'Sai email, số điện thoại hoặc mật khẩu',
            'auth_required': 'Vui lòng đăng nhập để truy cập trang Quản trị',
            'fill_fields': 'Vui lòng điền đầy đủ thông tin'
        };
        const errorMessage = rawError ? (ERROR_MAP[rawError] || decodeURIComponent(rawError)) : null;

        res.render('auth/admin_login', {
            title: 'Đăng nhập Quản trị - Bình Lợi Healing',
            error: errorMessage
        });
    },

    sendOtp: async (req, res) => {
        try {
            const { phone } = req.body;
            if (!phone || !/^[0-9]{10,11}$/.test(phone)) {
                return res.json({ success: false, message: 'Số điện thoại không hợp lệ' });
            }

            // Check if phone is already registered and active
            const [existingUser] = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
            if (existingUser.length > 0) {
                return res.json({ success: false, message: 'Số điện thoại này đã được đăng ký tài khoản' });
            }

            // Ensure verification table exists (PostgreSQL syntax)
            await db.query(`
                CREATE TABLE IF NOT EXISTS otp_verifications (
                    phone VARCHAR(20) PRIMARY KEY,
                    otp VARCHAR(10) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();

            // Save to verification table (PostgreSQL native UPSERT)
            await db.query(`
                INSERT INTO otp_verifications (phone, otp, expires_at)
                VALUES ($1, $2, NOW() + INTERVAL '5 minute')
                ON CONFLICT (phone) DO UPDATE SET otp = EXCLUDED.otp, expires_at = EXCLUDED.expires_at
            `, [phone, otp]);

            // Send real SMS OTP
            const sms = require('../utils/sms');
            const result = await sms.sendOTP(phone, otp);

            if (!result.success) {
                if (result.fallback) {
                    return res.json({
                        success: false,
                        message: 'Cổng gửi tin nhắn SMS chưa được cấu hình trên máy chủ. Vui lòng thiết lập TWILIO hoặc SPEEDSMS trong file .env!'
                    });
                } else {
                    return res.json({
                        success: false,
                        message: 'Lỗi khi gửi tin nhắn SMS xác thực. Vui lòng kiểm tra lại số điện thoại hoặc cấu hình!'
                    });
                }
            }

            res.json({
                success: true,
                message: 'Mã xác thực đã được gửi tới số điện thoại của bạn.'
            });
        } catch (err) {
            console.error("Send OTP error:", err);
            res.status(500).json({ success: false, message: 'Lỗi hệ thống khi gửi mã xác thực' });
        }
    },

    verifyOtp: async (req, res) => {
        try {
            const { phone, otp } = req.body;
            if (!phone || !otp) {
                return res.json({ success: false, message: 'Dữ liệu không đầy đủ' });
            }

            const [rows] = await db.query(
                "SELECT * FROM otp_verifications WHERE phone = $1 AND otp = $2 AND expires_at > NOW()",
                [phone, otp]
            );

            if (rows.length === 0) {
                return res.json({ success: false, message: 'Mã OTP không chính xác hoặc đã hết hạn.' });
            }

            // Delete OTP record once successfully verified
            await db.query("DELETE FROM otp_verifications WHERE phone = $1", [phone]);

            res.json({ success: true, verified: true });
        } catch (err) {
            console.error("Verify OTP error:", err);
            res.status(500).json({ success: false, message: 'Lỗi xác thực mã OTP' });
        }
    },

    handleRegister: async (req, res) => {
        try {
            const { fullName, phone, password } = req.body;
            if (!phone || !password || !fullName) {
                return res.redirect('/auth/login?error=Vui lòng điền đầy đủ thông tin');
            }

            // Validate phone format
            if (!/^[0-9]{10,11}$/.test(phone)) {
                return res.redirect('/auth/login?error=Số điện thoại không hợp lệ (10-11 chữ số)');
            }

            // Check if phone already exists
            const [existingPhone] = await db.query('SELECT id FROM users WHERE phone = $1', [phone]);
            if (existingPhone.length > 0) {
                return res.redirect('/auth/login?error=Số điện thoại này đã được sử dụng');
            }

            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = {
                id: uuidv4(),
                full_name: fullName,
                email: phone + '@phone.local',
                phone: phone,
                password: hashedPassword,
                role: 'user',
                points: 0
            };

            await db.query(
                'INSERT INTO users (id, full_name, email, phone, password, role, total_points, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, 1)',
                [newUser.id, newUser.full_name, newUser.email, newUser.phone, newUser.password, newUser.role, newUser.points]
            );

            // Establish express session and log the user in immediately
            await AuthController.establishSession(req, res, newUser);

            // Redirect directly to slow-living healing journey map
            return res.redirect('/journey');
        } catch (error) {
            console.error("Register Error:", error);
            res.redirect('/auth/login?error=Lỗi hệ thống khi đăng ký');
        }
    },

    handleSocialLogin: async (req, res) => {
        try {
            const { platform, email, name, avatar, id, phone, city } = req.body;
            
            const data = {
                email,
                fullName: name,
                avatar,
                phone,
                city,
                googleId: platform === 'google' ? id : null,
                facebookId: platform === 'facebook' ? id : null
            };

            const user = await User.createFromSocial(data);
            await AuthController.establishSession(req, res, user);
            
            const userEmail = (user.email || '').toLowerCase();
            const isBinhLoiAdmin = user.role === 'admin' || userEmail === 'binhloi.travel@gmail.com' || userEmail.includes('binhloi');
            
            let redirectUrl = '/';
            if (isBinhLoiAdmin) {
                redirectUrl = '/admin';
            } else if (user.role === 'manager') {
                redirectUrl = '/manager';
            }
            res.json({ success: true, redirect: redirectUrl });
        } catch (error) {
            console.error("Social login error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    oauthCallback: async (req, res) => {
        if (req.user) {
            await AuthController.establishSession(req, res, req.user);
            const userEmail = (req.user.email || '').toLowerCase();
            if (req.user.role === 'admin' || userEmail === 'binhloi.travel@gmail.com' || userEmail.includes('binhloi')) {
                return res.redirect('/admin');
            }
            if (req.user.role === 'manager') {
                return res.redirect('/manager');
            }
        }
        
        if (req.session && req.session.redirectUrl) {
            const target = req.session.redirectUrl;
            delete req.session.redirectUrl;
            return res.redirect(target);
        }

        res.redirect('/');
    },

    establishSession: async (req, res, user) => {
        let sessionUuid = req.cookies?.session_uuid;

        const [existingSessions] = await db.query(
            "SELECT uuid FROM user_sessions WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1",
            [user.id]
        );

        if (existingSessions.length > 0) {
            sessionUuid = existingSessions[0].uuid;
        } else if (!sessionUuid) {
            sessionUuid = uuidv4();
        }

        res.cookie('session_uuid', sessionUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });

        const session = await UserSession.findOrCreate(sessionUuid, req);
        await db.query(
            "UPDATE user_sessions SET user_id = $1 WHERE id = $2",
            [user.id, session.id]
        );

        req.session.user = {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
            avatar: user.avatar,
            phone: user.phone,
            managed_destination_id: user.managed_destination_id
        };
    },

    logout: (req, res) => {
        req.session.destroy();
        res.clearCookie('session_uuid');
        res.redirect('/');
    },

    handlePasswordLogin: (req, res, next) => {
        const isJson = req.xhr || req.headers.accept?.includes('application/json') || req.headers['content-type']?.includes('json');
        const { email, password } = req.body;
        const referer = req.headers.referer || '';
        const isAdminForm = referer.includes('/admin/login') || referer.includes('/admin');
        const loginRedirect = isAdminForm ? '/admin/login' : '/auth/login';

        const sendError = (msg) => {
            if (isJson) {
                return res.status(400).json({ success: false, message: msg });
            }
            return res.redirect(`${loginRedirect}?error=` + encodeURIComponent(msg));
        };

        if (!email || !password || password.trim() === '') {
            return sendError('Vui lòng điền đầy đủ thông tin');
        }

        const passport = require('../config/passport');
        passport.authenticate('local', (err, user, info) => {
            if (err) {
                console.error("Local login error:", err);
                return sendError('Lỗi hệ thống khi đăng nhập');
            }
            if (!user) {
                const msg = info?.message || 'Email hoặc mật khẩu không chính xác.';
                return sendError(msg);
            }
            req.logIn(user, async (loginErr) => {
                if (loginErr) {
                    console.error("Session login error:", loginErr);
                    return sendError('Lỗi khởi tạo phiên đăng nhập');
                }
                await AuthController.establishSession(req, res, user);

                const userEmail = (user.email || '').toLowerCase();
                const isBinhLoiAdmin = user.role === 'admin' || userEmail === 'binhloi.travel@gmail.com' || userEmail.includes('binhloi');

                let targetUrl = '/';
                if (isBinhLoiAdmin) targetUrl = '/admin';
                else if (user.role === 'manager') targetUrl = '/manager';
                else if (req.session && req.session.redirectUrl) {
                    const target = req.session.redirectUrl;
                    delete req.session.redirectUrl;
                    if (target && !target.startsWith('/auth') && !target.startsWith('/admin/login')) {
                        targetUrl = target;
                    }
                }

                if (isJson) {
                    return res.json({ success: true, redirect: targetUrl });
                }
                return res.redirect(targetUrl);
            });
        })(req, res, next);
    }
};

module.exports = AuthController;
