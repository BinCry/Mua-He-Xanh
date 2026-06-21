const express = require('express');
const router = express.Router();
const passport = require('passport');
const config = require('../config/env');

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

router.get('/brand-logo.png', async (req, res) => {
    try {
        const db = require('../core/database');
        const [rows] = await db.query('SELECT key_value FROM settings WHERE key_name = ?', ['brand_logo']);
        const logoData = rows[0]?.key_value;

        if (logoData && logoData.startsWith('data:image')) {
            const matches = logoData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const contentType = matches[1];
                const base64Data = matches[2];
                const buffer = Buffer.from(base64Data, 'base64');
                res.setHeader('Content-Type', contentType);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return res.send(buffer);
            }
        } else if (logoData && logoData.startsWith('http')) {
            return res.redirect(logoData);
        } else if (logoData) {
            const path = require('path');
            return res.sendFile(path.join(__dirname, '../../public', logoData));
        }

        const path = require('path');
        return res.sendFile(path.join(__dirname, '../../public/images/logo.png'));
    } catch (e) {
        console.error("Logo generate error:", e);
        const path = require('path');
        return res.sendFile(path.join(__dirname, '../../public/images/logo.png'));
    }
});

router.get('/manifest.json', async (req, res) => {
    try {
        const db = require('../core/database');
        const [rows] = await db.query('SELECT * FROM settings');
        const settings = {};
        rows.forEach(s => { settings[s.key_name] = s.key_value; });
        
        const brandName = settings.brand_name || 'Bình Lợi Healing';
        
        res.setHeader('Content-Type', 'application/json');
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
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});
router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/auth/login' }), 
    AuthController.oauthCallback
);

// Facebook OAuth
router.get('/auth/facebook', (req, res, next) => {
    if (!config.auth.facebook.appId || config.auth.facebook.appId === 'MISSING_APP_ID') {
        return res.redirect('/auth/login?error=Lỗi cấu hình Facebook: Thiếu App ID trên Server.');
    }
    passport.authenticate('facebook', { scope: ['public_profile', 'email'] })(req, res, next);
});
router.get('/auth/facebook/callback', 
    passport.authenticate('facebook', { failureRedirect: '/auth/login' }), 
    AuthController.oauthCallback
);

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

// General Upload API
router.post('/api/upload', ensureAuthenticated, upload.single('image'), UploadController.uploadImage);

// Logo Upload API (Admin only)
router.post('/api/admin/upload-logo', ensureAdmin, upload.single('image'), UploadController.uploadLogo);

module.exports = router;

