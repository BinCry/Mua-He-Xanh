const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');

class AuthController {
    
    loginPage = (req, res) => {
        res.render('auth/login', {
            title: 'Đăng nhập - Bình Lợi Healing',
            error: req.query.error || null
        });
    }

    handleLogin = async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await User.findByEmail(email);
            
            if (user && user.password === password) {
                await this.establishSession(req, res, user);
                return res.redirect('/summary');
            }
            
            res.redirect('/auth/login?error=Sai email hoặc mật khẩu');
        } catch (error) {
            console.error("Login error:", error);
            res.status(500).send("Internal Server Error");
        }
    }

    handleSocialLogin = async (req, res) => {
        try {
            const { platform, email, name, avatar, id } = req.body;
            
            const data = {
                email,
                fullName: name,
                avatar,
                googleId: platform === 'google' ? id : null,
                facebookId: platform === 'facebook' ? id : null
            };

            const user = await User.createFromSocial(data);
            await this.establishSession(req, res, user);
            
            res.json({ success: true, redirect: '/summary' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    establishSession = async (req, res, user) => {
        let sessionUuid = req.cookies.session_uuid;
        if (!sessionUuid) {
            const { v4: uuidv4 } = require('uuid');
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
    }

    logout = (req, res) => {
        req.session.destroy();
        res.clearCookie('session_uuid');
        res.redirect('/');
    }
}

module.exports = new AuthController();
