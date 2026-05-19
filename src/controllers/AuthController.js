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
                'INSERT INTO users (id, full_name, email, phone, password, role, total_points, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
                [newUser.id, newUser.full_name, newUser.email, newUser.phone, newUser.password, newUser.role, newUser.points]
            );

            // Redirect user back with an informative pending approval alert
            return res.redirect('/auth/login?error=Tạo+tài+khoản+thành+công!+Vui+lòng+chờ+Ban+Quản+trị+phê+duyệt+để+đăng+nhập.');
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
        res.redirect('/');
    },

    establishSession: async (req, res, user) => {
        let sessionUuid = req.cookies.session_uuid;
        if (!sessionUuid) {
            sessionUuid = uuidv4();
            res.cookie('session_uuid', sessionUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
        }

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
