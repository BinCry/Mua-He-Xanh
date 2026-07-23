const express = require('express');
const router = express.Router();
const passport = require('passport');
const config = require('../config/env');
const { normalizeImagePath } = require('../utils/imagePaths');

// Controllers
const HomeController = require('../controllers/HomeController');
const ApiController = require('../controllers/ApiController');
const ExploreController = require('../controllers/ExploreController');
const JourneyController = require('../controllers/JourneyController');
const OnboardingController = require('../controllers/OnboardingController');
const CheckinController = require('../controllers/CheckinController');
const SummaryController = require('../controllers/SummaryController');
const MapController = require('../controllers/MapController');
const PassportController = require('../controllers/PassportController');
const ChatController = require('../controllers/ChatController');
const AuthController = require('../controllers/AuthController');
const WorkshopController = require('../controllers/WorkshopController');
const ProfileController = require('../controllers/ProfileController');
const AdminController = require('../controllers/AdminController');
const ReviewController = require('../controllers/ReviewController');
const UploadController = require('../controllers/UploadController');
const upload = require('../middleware/upload');
const FestivalController = require('../controllers/FestivalController');
const EventController = require('../controllers/EventController');

// Middleware
const { ensureAuthenticated, ensureAdmin, ensureManager, ensureTourist } = require('../middleware/auth');
const ManagerController = require('../controllers/ManagerController');

// ===== PUBLIC PAGES =====
router.get('/', HomeController.index);
router.get('/onboarding', OnboardingController.index);
router.get('/checkin', ensureAuthenticated, CheckinController.index);

// Dynamic manifest.json endpoint to keep PWA name and logo synchronized with Admin Settings
router.get('/manifest.json', async (req, res) => {
    try {
        const db = require('../core/database');
        const [rows] = await db.query('SELECT * FROM settings');
        const settings = {};
        rows.forEach(s => { settings[s.key_name] = s.key_value; });
        
        const normalizedLogo = normalizeImagePath(settings.brand_logo, '/images/logo.png');
        const logoUrl = normalizedLogo.startsWith('data:image') ? '/brand-logo.png' : normalizedLogo;

        const manifest = {
            "name": settings.brand_name || "Bình Lợi - Miền Tây giữa lòng Sài Gòn",
            "short_name": settings.brand_name || "Bình Lợi Healing",
            "description": settings.brand_subtext || "Hành trình khám phá và chữa lành tại làng quê Bình Lợi",
            "start_url": "/",
            "display": "standalone",
            "background_color": "#ffffff",
            "theme_color": "#922724",
            "orientation": "portrait-primary",
            "icons": [
                {
                    "src": logoUrl,
                    "sizes": "192x192",
                    "type": "image/png",
                    "purpose": "any"
                },
                {
                    "src": logoUrl,
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "any"
                }
            ]
        };
        
        res.header('Content-Type', 'application/manifest+json');
        res.json(manifest);
    } catch (e) {
        console.error("Error generating manifest dynamically:", e);
        res.header('Content-Type', 'application/manifest+json');
        res.json({
            "name": "Bình Lợi - Miền Tây giữa lòng Sài Gòn",
            "short_name": "Bình Lợi Healing",
            "start_url": "/",
            "display": "standalone",
            "background_color": "#ffffff",
            "theme_color": "#922724",
            "orientation": "portrait-primary",
            "icons": [
                {
                    "src": "/images/logo.png",
                    "sizes": "192x192",
                    "type": "image/png",
                    "purpose": "any"
                },
                {
                    "src": "/images/logo.png",
                    "sizes": "512x512",
                    "type": "image/png",
                    "purpose": "any"
                }
            ]
        });
    }
});

// Test QR page - shows all destination QR codes for testing
router.get('/test-qr', async (req, res) => {
    try {
        const db = require('../core/database');
        const [dests] = await db.query('SELECT name, slug FROM destinations WHERE is_active = 1 ORDER BY name');
        let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Test QR Codes</title>
        <style>body{font-family:sans-serif;padding:20px;background:#1a1a2e;color:white;text-align:center;}
        .grid{display:flex;flex-wrap:wrap;gap:20px;justify-content:center;}
        .card{background:#16213e;padding:20px;border-radius:16px;width:250px;}
        .card img{border-radius:8px;background:white;padding:8px;}
        h1{color:#e94560;}h3{margin:10px 0 5px;font-size:14px;}
        code{font-size:11px;color:#0f3460;background:#e2e2e2;padding:2px 6px;border-radius:4px;}</style></head>
        <body><h1>🔍 Test QR Codes</h1>
        <p>Quét các mã QR bên dưới để test check-in. Mỗi mã chứa slug của địa điểm.</p>
        <div class="grid">`;
        for (const d of dests) {
            html += `<div class="card">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(d.slug)}" width="180" height="180">
                <h3>${d.name}</h3>
                <code>${d.slug}</code>
            </div>`;
        }
        html += `</div></body></html>`;
        res.send(html);
    } catch(e) {
        res.status(500).send('Error: ' + e.message);
    }
});

router.get('/brand-logo.png', async (req, res) => {
    try {
        const db = require('../core/database');
        const [rows] = await db.query('SELECT key_value FROM settings WHERE key_name = ?', ['brand_logo']);
        const logoData = rows[0]?.key_value;

        const normalizedLogo = normalizeImagePath(logoData, '/images/logo.png');

        if (normalizedLogo && normalizedLogo.startsWith('data:image')) {
            const matches = normalizedLogo.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const contentType = matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.send(buffer);
            }
        } else if (normalizedLogo && normalizedLogo.startsWith('http')) {
            return res.redirect(normalizedLogo);
        } else if (normalizedLogo) {
            const path = require('path');
            return res.sendFile(path.join(process.cwd(), 'public', normalizedLogo.replace(/^\//, '').split('?')[0]));
        }

        const path = require('path');
        return res.sendFile(path.join(process.cwd(), 'public/images/logo.png'));
    } catch (e) {
        console.error("Logo generate error:", e);
        const path = require('path');
        return res.sendFile(path.join(process.cwd(), 'public/images/logo.png'));
    }
});

router.get('/manifest.json', async (req, res) => {
    try {
        const db = require('../core/database');
        const [rows] = await db.query('SELECT * FROM settings');
        const settings = {};
        rows.forEach(s => { settings[s.key_name] = s.key_value; });
        
        const brandName = settings.brand_name || 'Bình Lợi Healing';
        
        res.setHeader('Content-Type', 'application/manifest+json');
        res.json({
            "name": brandName,
            "short_name": brandName.split(' ')[0] || "Bình Lợi",
            "description": "Nền tảng du lịch chữa lành và khám phá văn hóa Bình Lợi.",
            "start_url": "/",
            "display": "standalone",
            "background_color": "#f8faf9",
            "theme_color": "#922724",
            "orientation": "portrait-primary",
            "icons": [
                {
                    "src": "/brand-logo.png",
                    "sizes": "192x192",
                    "type": "image/png"
                },
                {
                    "src": "/brand-logo.png",
                    "sizes": "512x512",
                    "type": "image/png"
                }
            ]
        });
    } catch (e) {
        console.error("Manifest generate error:", e);
        res.json({
            "name": "Bình Lợi Healing",
            "short_name": "Bình Lợi",
            "start_url": "/",
            "display": "standalone",
            "background_color": "#f8faf9",
            "theme_color": "#922724",
            "icons": [
                {
                    "src": "/brand-logo.png",
                    "sizes": "192x192",
                    "type": "image/png"
                },
                {
                    "src": "/brand-logo.png",
                    "sizes": "512x512",
                    "type": "image/png"
                }
            ]
        });
    }
});


// ===== EXPLORE =====
router.get('/explore', ExploreController.list);
router.get('/explore/:slug', ExploreController.show);

// ===== WORKSHOP =====
router.get('/workshops', WorkshopController.index);
router.get('/workshops/:id', WorkshopController.show);
router.get('/my-workshops', ensureAuthenticated, WorkshopController.myBookings);
router.get('/api/workshop/slots', WorkshopController.getSlots);
router.post('/api/workshop/book', ensureAuthenticated, WorkshopController.book);
router.post('/api/workshop/cancel', ensureAuthenticated, WorkshopController.cancel);
router.post('/api/workshop/review', ensureAuthenticated, WorkshopController.review);

// ===== COMMUNITY (Reviews) =====
router.get('/reviews', ReviewController.index);
router.get('/reviews/video-editor', ensureAuthenticated, ReviewController.videoEditor);

// ===== MAP =====
router.get('/map', MapController.index);

// ===== JOURNEY =====
router.get('/journey', JourneyController.index);
router.get('/hanh-trinh-cua-toi', JourneyController.index);
router.get('/journey/suggestions', JourneyController.suggestions);
router.post('/journey/confirm', JourneyController.confirm);
router.get('/journey/preset/:theme', JourneyController.preset);
router.get('/journey/load-template/:id', JourneyController.loadTemplate);

// ===== AUTH PAGES =====
router.get('/passport', ensureTourist, PassportController.index);
router.get('/chat', ensureAuthenticated, ChatController.index);
router.get('/summary', SummaryController.index);
router.get('/festivals', FestivalController.index);
router.get('/events/:id', EventController.show);

// ===== PROFILE =====
router.get('/profile', ensureTourist, ProfileController.index);
router.get('/profile/edit', ensureTourist, ProfileController.editPage);
router.post('/profile/update', ensureTourist, ProfileController.update);
router.get('/profile/rewards', ensureTourist, ProfileController.rewards);

// ===== ADMIN =====
router.get('/admin', ensureAdmin, AdminController.dashboard);
router.get('/admin/users', ensureAdmin, AdminController.users);
router.get('/admin/destinations', ensureAdmin, AdminController.destinations);
router.get('/admin/settings', ensureAdmin, AdminController.siteSettings);
router.get('/admin/workshops', ensureAdmin, AdminController.workshops);
router.get('/admin/reviews', ensureAdmin, AdminController.reviews);
router.get('/admin/events', ensureAdmin, AdminController.events);
router.get('/admin/journey-templates', ensureAdmin, AdminController.journeyTemplates);
router.get('/admin/chat', ensureAdmin, AdminController.chat);
router.get('/api/admin/chat-history', ensureAdmin, AdminController.getChatHistory);

// ===== MANAGER =====
router.get('/manager', ensureManager, ManagerController.index);
router.get('/manager/chat', ensureManager, ManagerController.chat);
router.get('/manager/destination', ensureManager, ManagerController.destination);
router.get('/manager/workshops', ensureManager, ManagerController.workshops);
router.post('/manager/update', ensureManager, ManagerController.updateDestination);
router.get('/api/manager/chat-history', ensureManager, ManagerController.getChatHistory);
router.post('/api/reply-message', ensureManager, ApiController.replyMessage);
router.post('/api/manager/create-workshop', ensureManager, ManagerController.createWorkshop);
router.post('/api/manager/update-workshop', ensureManager, ManagerController.updateWorkshop);
router.post('/api/manager/delete-workshop', ensureManager, ManagerController.deleteWorkshop);

// ===== AUTH ROUTES =====
router.get('/auth/login', AuthController.loginPage);
router.post('/auth/register', AuthController.handleRegister);
router.post('/auth/send-otp', AuthController.sendOtp);
router.post('/auth/verify-otp', AuthController.verifyOtp);
router.post('/auth/login', passport.authenticate('local', { failureRedirect: '/auth/login?error=Sai email hoặc mật khẩu' }), AuthController.oauthCallback);
router.post('/auth/social', AuthController.handleSocialLogin);
router.get('/auth/logout', AuthController.logout);

// Google OAuth
router.get('/auth/google', (req, res, next) => {
    if (!config.auth.google.clientId || config.auth.google.clientId === 'MISSING_CLIENT_ID') {
        return res.redirect('/auth/login?error=Lỗi cấu hình Google: Thiếu Client ID trên Server.');
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const dynamicCallbackUrl = `${protocol}://${host}/auth/google/callback`;

    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        callbackURL: dynamicCallbackUrl
    })(req, res, next);
});
router.get('/auth/google/callback', (req, res, next) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const dynamicCallbackUrl = `${protocol}://${host}/auth/google/callback`;

    passport.authenticate('google', { 
        failureRedirect: '/auth/login',
        callbackURL: dynamicCallbackUrl
    })(req, res, next);
}, AuthController.oauthCallback);

// Facebook OAuth
router.get('/auth/facebook', (req, res, next) => {
    if (!config.auth.facebook.appId || config.auth.facebook.appId === 'MISSING_APP_ID') {
        return res.redirect('/auth/login?error=Lỗi cấu hình Facebook: Thiếu App ID trên Server.');
    }
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const dynamicCallbackUrl = `${protocol}://${host}/auth/facebook/callback`;

    passport.authenticate('facebook', { 
        scope: ['public_profile'],
        callbackURL: dynamicCallbackUrl
    })(req, res, next);
});
router.get('/auth/facebook/callback', (req, res, next) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const dynamicCallbackUrl = `${protocol}://${host}/auth/facebook/callback`;

    passport.authenticate('facebook', { 
        callbackURL: dynamicCallbackUrl
    }, (err, user, info) => {
        console.log('=== FACEBOOK CALLBACK DEBUG ===');
        console.log('Error:', err);
        console.log('User:', user ? user.id : 'NULL');
        console.log('Info:', info);
        console.log('===============================');
        
        if (err) {
            console.error('Facebook Auth Error:', err);
            return res.redirect('/auth/login?error=' + encodeURIComponent('Lỗi Facebook: ' + err.message));
        }
        if (!user) {
            const msg = (info && info.message) ? info.message : 'Đăng nhập Facebook thất bại';
            return res.redirect('/auth/login?error=' + encodeURIComponent(msg));
        }
        
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error('Facebook Login Session Error:', loginErr);
                return res.redirect('/auth/login?error=' + encodeURIComponent('Lỗi tạo phiên đăng nhập'));
            }
            AuthController.oauthCallback(req, res, next);
        });
    })(req, res, next);
});

// ===== API ROUTES =====
router.all('/api/session', ApiController.session);
router.all('/api/session/:uuid', ApiController.session);
router.get('/api/destinations', ApiController.destinations);
router.post('/api/journey', ApiController.journey);
router.post('/api/journey/update-stop', ApiController.updateJourneyStop);
router.post('/api/checkin', ApiController.checkin);
router.post('/api/send-message', ensureAuthenticated, ApiController.sendMessage);
router.get('/api/get-messages', ensureAuthenticated, ApiController.getMessages);
router.post('/api/festival/book', FestivalController.book);
router.get('/api/soundscapes', ApiController.getSoundscapes);

// Destination interactions
router.post('/api/destination/like', ensureAuthenticated, ApiController.like);
router.post('/api/destination/save', ensureAuthenticated, ApiController.save);
router.post('/api/destination/add-to-journey', ensureAuthenticated, ApiController.addToJourney);

// Review API
router.post('/api/reviews', ensureAuthenticated, ReviewController.create);
router.post('/api/reviews/like', ensureAuthenticated, ReviewController.toggleLike);
router.post('/api/reviews/comment', ensureAuthenticated, ReviewController.comment);

// Profile API
router.post('/api/redeem-reward', ensureAuthenticated, ProfileController.redeemReward);

// Admin API - Users
router.post('/api/admin/create-user', ensureAdmin, AdminController.createUser);
router.post('/api/admin/update-user', ensureAdmin, AdminController.updateUser);
router.post('/api/admin/delete-user', ensureAdmin, AdminController.deleteUser);

// Admin API - Destinations
router.post('/api/admin/resolve-maps-link', ensureAdmin, AdminController.resolveMapsLink);
router.post('/api/admin/create-destination', ensureAdmin, AdminController.createDestination);
router.post('/api/admin/update-destination', ensureAdmin, AdminController.updateDestination);
router.post('/api/admin/delete-destination', ensureAdmin, AdminController.deleteDestination);
router.post('/api/admin/toggle-destination', ensureAdmin, AdminController.toggleDestination);

// Admin API - Workshops
router.post('/api/admin/create-workshop', ensureAdmin, AdminController.createWorkshop);
router.post('/api/admin/update-workshop', ensureAdmin, AdminController.updateWorkshop);
router.post('/api/admin/delete-workshop', ensureAdmin, AdminController.deleteWorkshop);

// Admin API - Reviews
router.post('/api/admin/delete-review', ensureAdmin, AdminController.deleteReview);
router.post('/api/admin/create-soundscape', ensureAdmin, upload.single('audio'), AdminController.createSoundscape);
router.post('/api/admin/delete-soundscape', ensureAdmin, AdminController.deleteSoundscape);

// Admin API - Events
router.post('/api/admin/create-event', ensureAdmin, AdminController.createEvent);
router.post('/api/admin/update-event', ensureAdmin, AdminController.updateEvent);
router.post('/api/admin/delete-event', ensureAdmin, AdminController.deleteEvent);

// Admin API - Settings
router.post('/api/admin/update-settings', ensureAdmin, AdminController.updateSettings);

// Admin API - Journey Templates
router.post('/api/admin/create-journey-template', ensureAdmin, AdminController.createJourneyTemplate);
router.post('/api/admin/update-journey-template', ensureAdmin, AdminController.updateJourneyTemplate);
router.post('/api/admin/delete-journey-template', ensureAdmin, AdminController.deleteJourneyTemplate);

// General Upload API (with multer error handling)
router.post('/api/upload', ensureAuthenticated, (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Multer Upload Error:', err);
            const message = err.code === 'LIMIT_FILE_SIZE' 
                ? 'File quá lớn! Giới hạn 25MB.' 
                : (err.message || 'Lỗi khi tải file lên.');
            return res.status(400).json({ success: false, message });
        }
        UploadController.uploadImage(req, res).catch(next);
    });
});

// Logo Upload API (Admin only, with multer error handling)
router.post('/api/admin/upload-logo', ensureAdmin, (req, res, next) => {
    upload.single('image')(req, res, (err) => {
        if (err) {
            console.error('Multer Logo Upload Error:', err);
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'File quá lớn! Giới hạn 25MB.'
                : (err.message || 'Lỗi khi tải file lên.');
            return res.status(400).json({ success: false, message });
        }
        UploadController.uploadLogo(req, res).catch(next);
    });
});

module.exports = router;

