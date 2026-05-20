const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');
const db = require('../core/database');

const AuthController = {
    
    loginPage: (req, res) => {
        const config = require('../config/env');
        res.render('auth/login', {
            title: 'Đăng nhập - Bình Lợi Healing',
            error: req.query.error || null,
            facebookConfigured: !!(config.auth.facebook.appId && config.auth.facebook.appId !== 'MISSING_APP_ID')
        });
    },

    sendOtp: async (req, res) => {
        try {
            const { phone } = req.body;
            if (!phone || !/^[0-9]{10,11}$/.test(phone)) {
                return res.json({ success: false, message: 'Số điện thoại không hợp lệ' });
            }

            // Check if phone is already registered and active
            const [existingUser] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
            if (existingUser.length > 0) {
                return res.json({ success: false, message: 'Số điện thoại này đã được đăng ký tài khoản' });
            }

            // Ensure verification table exists
            await db.query(`
                CREATE TABLE IF NOT EXISTS otp_verifications (
                    phone VARCHAR(20) PRIMARY KEY,
                    otp VARCHAR(10) NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);

            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();

            // Save to verification table
            await db.query(`
                INSERT INTO otp_verifications (phone, otp, expires_at)
                VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))
                ON DUPLICATE KEY UPDATE otp = VALUES(otp), expires_at = VALUES(expires_at)
            `, [phone, otp]);

            // Send real SMS OTP
            const sms = require('../utils/sms');
            const result = await sms.sendOTP(phone, otp);

            res.json({
                success: true,
                message: 'Mã xác thực đã được gửi tới số điện thoại của bạn.',
                fallback: result.fallback || false,
                otp: result.fallback ? otp : null // Return OTP for visual hint only if SMS API credentials are not set
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
                "SELECT * FROM otp_verifications WHERE phone = ? AND otp = ? AND expires_at > NOW()",
                [phone, otp]
            );

            if (rows.length === 0) {
                return res.json({ success: false, message: 'Mã OTP không chính xác hoặc đã hết hạn.' });
            }

            // Delete OTP record once successfully verified
            await db.query("DELETE FROM otp_verifications WHERE phone = ?", [phone]);

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
            const [existingPhone] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
            if (existingPhone.length > 0) {
                return res.redirect('/auth/login?error=Số điện thoại này đã được sử dụng');
            }

            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = {
                id: uuidv4(),
                full_name: fullName,
                email: phone + '@phone.local', // Internal email placeholder
                phone: phone,
                password: hashedPassword,
                role: 'user',
                points: 0
            };

            await db.query(
                'INSERT INTO users (id, full_name, email, phone, password, role, total_points, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
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
            
            res.json({ success: true, redirect: '/' });
        } catch (error) {
            console.error("Social login error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    oauthCallback: async (req, res) => {
        // Passport already put user in req.user
        if (req.user) {
            await AuthController.establishSession(req, res, req.user);
        }
        
        // Redirect based on role
        if (req.user && req.user.role === 'admin') {
            return res.redirect('/admin');
        }
        if (req.user && req.user.role === 'manager') {
            return res.redirect('/manager');
        }
        res.redirect('/');
    },

    establishSession: async (req, res, user) => {
        let sessionUuid = req.cookies.session_uuid;

        // Try to reuse user's existing session from database
        const [existingSessions] = await db.query(
            "SELECT uuid FROM user_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
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
            "UPDATE user_sessions SET user_id = ? WHERE id = ?",
            [user.id, session.id]
        );

        // Store user in express session
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
    }
};

module.exports = AuthController;
