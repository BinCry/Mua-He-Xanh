const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');

const AuthController = {
    
    loginPage: (req, res) => {
        res.render('auth/login', {
            title: 'Đăng nhập - Bình Lợi Healing',
            error: req.query.error || null
        });
    },

    handleLogin: async (req, res) => {
        try {
            console.log("LOGIN DEBUG - Start");
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.redirect('/auth/login?error=Vui lòng nhập đầy đủ thông tin');
            }

            const user = await User.findByEmail(email);
            console.log("LOGIN DEBUG - User lookup done:", user ? user.email : "Not found");

            if (user && user.password === password) {
                await AuthController.establishSession(req, res, user);
                
                if (user.role === 'admin' || user.role === 'manager') {
                    return res.redirect('/manager');
                }
                return res.redirect('/summary');
            }
            
            res.redirect('/auth/login?error=Sai email hoặc mật khẩu');
        } catch (error) {
            console.error("LOGIN DEBUG - CRITICAL ERROR:", error);
            res.status(500).send("Lỗi đăng nhập: " + error.message);
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
            
            res.json({ success: true, redirect: '/summary' });
        } catch (error) {
            console.error("Social login error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    },

    oauthCallback: async (req, res) => {
        // Passport already put user in req.user
        // We still run establishSession to sync with our custom user_sessions table if needed
        if (req.user) {
            await AuthController.establishSession(req, res, req.user);
        }
        res.redirect('/summary');
    },

    establishSession: async (req, res, user) => {
        let sessionUuid = req.cookies.session_uuid;
        if (!sessionUuid) {
            sessionUuid = uuidv4();
            res.cookie('session_uuid', sessionUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
        }

        const session = await UserSession.findOrCreate(sessionUuid, req);
        await UserSession.db.query(
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
