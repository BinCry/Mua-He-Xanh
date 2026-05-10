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

    handleRegister: async (req, res) => {
        try {
            const { fullName, email, password } = req.body;
            if (!email || !password || !fullName) {
                return res.redirect('/auth/login?error=Vui lòng điền đầy đủ thông tin');
            }

            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.redirect('/auth/login?error=Email này đã được sử dụng');
            }

            const bcrypt = require('bcryptjs');
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(password, salt);

            const newUser = {
                id: uuidv4(),
                full_name: fullName,
                email: email,
                password: hashedPassword,
                role: 'user',
                points: 0
            };

            await UserSession.db.query(
                'INSERT INTO users (id, full_name, email, password, role, points) VALUES (?, ?, ?, ?, ?, ?)',
                [newUser.id, newUser.full_name, newUser.email, newUser.password, newUser.role, newUser.points]
            );

            // Log them in immediately
            req.login(newUser, async (err) => {
                if (err) return res.redirect('/auth/login?error=Lỗi đăng nhập sau khi đăng ký');
                await AuthController.establishSession(req, res, newUser);
                return res.redirect('/summary');
            });
        } catch (error) {
            console.error("Register Error:", error);
            res.redirect('/auth/login?error=Lỗi hệ thống khi đăng ký');
        }
    },

    devBypass: async (req, res) => {
        try {
            // Find or create an admin user
            const [admins] = await UserSession.db.query("SELECT * FROM users WHERE role = 'admin' LIMIT 1");
            let adminUser = admins[0];
            
            if (!adminUser) {
                adminUser = {
                    id: uuidv4(),
                    full_name: 'Bypass Admin',
                    email: 'admin@binhloi.local',
                    role: 'admin',
                    points: 9999
                };
                await UserSession.db.query(
                    'INSERT INTO users (id, full_name, email, role, points) VALUES (?, ?, ?, ?, ?)',
                    [adminUser.id, adminUser.full_name, adminUser.email, adminUser.role, adminUser.points]
                );
            }

            req.login(adminUser, async (err) => {
                if (err) return res.redirect('/auth/login?error=Bypass failed');
                await AuthController.establishSession(req, res, adminUser);
                return res.redirect('/manager'); // Admins go to manager
            });
        } catch (error) {
            res.status(500).send(error.message);
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
