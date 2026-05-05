const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');

class AuthController {
    
    async loginPage(req, res) {
        res.render('auth/login', {
            title: 'Đăng nhập - Bình Lợi Healing',
            error: req.query.error || null
        });
    }

    async handleLogin(req, res) {
        const { email, password } = req.body;
        const user = await User.findByEmail(email);
        
        // Basic password check (in real app, use bcrypt)
        if (user && user.password === password) {
            await this.establishSession(req, res, user);
            return res.redirect('/summary');
        }
        
        res.redirect('/auth/login?error=Sai email hoặc mật khẩu');
    }

    async handleSocialLogin(req, res) {
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
    }

    async establishSession(req, res, user) {
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
        req.session.user = user;
    }

    async logout(req, res) {
        req.session.destroy();
        res.clearCookie('session_uuid');
        res.redirect('/');
    }
}

module.exports = new AuthController();
