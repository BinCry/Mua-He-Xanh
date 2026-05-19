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

// Middleware
const { ensureAuthenticated, ensureAdmin, ensureManager, ensureTourist } = require('../middleware/auth');
const ManagerController = require('../controllers/ManagerController');

// ===== PUBLIC PAGES =====
router.get('/', HomeController.index);
router.get('/onboarding', OnboardingController.index);
router.get('/checkin', CheckinController.index);

// ===== EXPLORE =====
router.get('/explore', ExploreController.list);
router.get('/explore/:slug', ExploreController.show);

// ===== WORKSHOP =====
router.get('/workshops', WorkshopController.index);
router.get('/workshops/:id', WorkshopController.show);

// ===== COMMUNITY (Reviews) =====
router.get('/reviews', ReviewController.index);

// ===== MAP =====
router.get('/map', MapController.index);

// ===== JOURNEY =====
router.get('/journey', JourneyController.index);
router.get('/hanh-trinh-cua-toi', JourneyController.index);
router.get('/journey/suggestions', JourneyController.suggestions);
router.post('/journey/confirm', JourneyController.confirm);
router.get('/journey/preset/:theme', JourneyController.preset);

// ===== AUTH PAGES =====
router.get('/passport', ensureTourist, PassportController.index);
router.get('/chat', ensureAuthenticated, ChatController.index);
router.get('/summary', SummaryController.index);
router.get('/festivals', FestivalController.index);

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

// ===== MANAGER =====
router.get('/manager', ensureManager, ManagerController.index);
router.post('/manager/update', ensureManager, ManagerController.updateDestination);
router.get('/api/manager/chat-history', ensureManager, ManagerController.getChatHistory);
router.post('/api/reply-message', ensureManager, ApiController.replyMessage);

// ===== AUTH ROUTES =====
router.get('/auth/login', AuthController.loginPage);
router.post('/auth/register', AuthController.handleRegister);
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
router.post('/api/send-message', ApiController.sendMessage);
router.get('/api/get-messages', ApiController.getMessages);
router.post('/api/festival/book', FestivalController.book);

// Review API
router.post('/api/reviews', ensureAuthenticated, ReviewController.create);
router.post('/api/reviews/like', ensureAuthenticated, ReviewController.toggleLike);
router.post('/api/reviews/comment', ensureAuthenticated, ReviewController.comment);

// Profile API
router.post('/api/redeem-reward', ensureAuthenticated, ProfileController.redeemReward);

// Admin API — Users
router.post('/api/admin/create-user', ensureAdmin, AdminController.createUser);
router.post('/api/admin/update-user', ensureAdmin, AdminController.updateUser);
router.post('/api/admin/delete-user', ensureAdmin, AdminController.deleteUser);

// Admin API — Destinations
router.post('/api/admin/create-destination', ensureAdmin, AdminController.createDestination);
router.post('/api/admin/update-destination', ensureAdmin, AdminController.updateDestination);
router.post('/api/admin/delete-destination', ensureAdmin, AdminController.deleteDestination);
router.post('/api/admin/toggle-destination', ensureAdmin, AdminController.toggleDestination);

// Admin API — Workshops
router.post('/api/admin/create-workshop', ensureAdmin, AdminController.createWorkshop);
router.post('/api/admin/update-workshop', ensureAdmin, AdminController.updateWorkshop);
router.post('/api/admin/delete-workshop', ensureAdmin, AdminController.deleteWorkshop);

// Admin API — Reviews
router.post('/api/admin/delete-review', ensureAdmin, AdminController.deleteReview);

// Admin API — Events
router.post('/api/admin/create-event', ensureAdmin, AdminController.createEvent);
router.post('/api/admin/update-event', ensureAdmin, AdminController.updateEvent);
router.post('/api/admin/delete-event', ensureAdmin, AdminController.deleteEvent);

// Admin API — Settings
router.post('/api/admin/update-settings', ensureAdmin, AdminController.updateSettings);

// General Upload API
router.post('/api/upload', ensureAuthenticated, upload.single('image'), UploadController.uploadImage);

module.exports = router;
