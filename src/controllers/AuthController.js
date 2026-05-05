const User = require('../models/User');
const UserSession = require('../models/UserSession');
const { v4: uuidv4 } = require('uuid');

class AuthController {
    constructor() {
        this.loginPage = this.loginPage.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handleSocialLogin = this.handleSocialLogin.bind(this);
        this.establishSession = this.establishSession.bind(this);
        this.logout = this.logout.bind(this);
    }
    
    async loginPage(req, res) {
        res.render('auth/login', {
            title: 'Đăng nhập - Bình Lợi Healing',
            error: req.query.error || null
        });
    }

    async handleLogin(req, res) {
        try {
            console.log("Login attempt:", req.body.email);
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.redirect('/auth/login?error=Vui lòng nhập đầy đủ thông tin');
            }

            const user = await User.findByEmail(email);
            console.log("User found:", user ? user.email : "No");

            if (user && user.password === password) {
                await this.establishSession(req, res, user);
                console.log("Session established for:", user.email);
                return res.redirect('/summary');
            }
            
            res.redirect('/auth/login?error=Sai email hoặc mật khẩu');
        } catch (error) {
            console.error("CRITICAL Login error:", error);
            res.status(500).send("Internal Server Error: " + error.message);
        }
    }

    async handleSocialLogin(req, res) {
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
            console.error("Social login error:", error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async establishSession(req, res, user) {
        try {
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
            
            return true;
        } catch (e) {
            console.error("Session establishment failed:", e);
            throw e;
        }
    }

    async logout(req, res) {
        req.session.destroy();
        res.clearCookie('session_uuid');
        res.redirect('/');
    }
}

module.exports = new AuthController();
