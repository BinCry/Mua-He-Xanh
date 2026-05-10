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
const ManagerController = require('../controllers/ManagerController');
const PassportController = require('../controllers/PassportController');
const ChatController = require('../controllers/ChatController');
const MarketController = require('../controllers/MarketController');
const FestivalController = require('../controllers/FestivalController');
const AuthController = require('../controllers/AuthController');
const WorkshopController = require('../controllers/WorkshopController');
const ProfileController = require('../controllers/ProfileController');
const AdminController = require('../controllers/AdminController');
const ReviewController = require('../controllers/ReviewController');
const CartController = require('../controllers/CartController');

// Middleware
const { ensureAuthenticated, ensureManager, ensureAdmin, restrictToManagers } = require('../middleware/auth');

// ===== PUBLIC PAGES =====
router.get('/', HomeController.index);
router.get('/onboarding', OnboardingController.index);
router.get('/checkin', CheckinController.index);
router.get('/market', MarketController.index);
router.get('/market/:id', MarketController.detail);

// ===== CART & ORDERS (Chương 5.12) =====
router.get('/cart', ensureAuthenticated, CartController.index);
router.get('/my-orders', ensureAuthenticated, CartController.orders);
router.get('/festivals', FestivalController.index);
router.get('/map', MapController.index);
router.get('/explore', ExploreController.list);
router.get('/explore/:slug', ExploreController.show);
router.get('/audio/:slug', ExploreController.audio);

// ===== WORKSHOP (Chương 5.11) =====
router.get('/workshops', WorkshopController.index);
router.get('/workshops/:id', WorkshopController.show);
router.get('/my-workshops', ensureAuthenticated, WorkshopController.myBookings);

// ===== REVIEWS & COMMUNITY (Chương 5.13) =====
router.get('/reviews', ReviewController.index);

// ===== JOURNEY (Chương 5.5) =====
router.get('/journey', JourneyController.index);
router.get('/hanh-trinh-cua-toi', JourneyController.index);
router.get('/journey/suggestions', JourneyController.suggestions);
router.post('/journey/confirm', JourneyController.confirm);
router.get('/journey/preset/:theme', JourneyController.preset);

// ===== AUTH PAGES (Chương 5.1) =====
router.get('/passport', ensureAuthenticated, PassportController.index);
router.get('/chat', ensureAuthenticated, ChatController.index);
router.get('/summary', SummaryController.index);

// ===== PROFILE (Chương 5.2) =====
router.get('/profile', ensureAuthenticated, ProfileController.index);
router.get('/profile/edit', ensureAuthenticated, ProfileController.editPage);
router.post('/profile/update', ensureAuthenticated, ProfileController.update);
router.get('/profile/rewards', ensureAuthenticated, ProfileController.rewards);

// ===== MANAGER (Chương 6) =====
router.get('/manager', ensureManager, ManagerController.index);
router.post('/manager/update', ensureManager, ManagerController.updateDestination);

// ===== ADMIN (Chương 7 - Pattern Relioo checkSuperAdminAccess) =====
router.get('/admin', ensureAdmin, AdminController.dashboard);
router.get('/admin/users', ensureAdmin, AdminController.users);
router.get('/admin/workshops', ensureAdmin, AdminController.workshops);
router.get('/admin/reviews', ensureAdmin, AdminController.reviews);

// ===== AUTH ROUTES (Chương 5.1) =====
router.get('/auth/login', AuthController.loginPage);
router.post('/auth/register', AuthController.handleRegister);
router.post('/auth/login', passport.authenticate('local', { failureRedirect: '/auth/login?error=Sai email hoặc mật khẩu' }), AuthController.oauthCallback);
router.post('/auth/bypass', AuthController.devBypass);
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
// Session & Core
router.all('/api/session', ApiController.session);
router.all('/api/session/:uuid', ApiController.session);
router.get('/api/destinations', ApiController.destinations);
router.post('/api/journey', ApiController.journey);
router.post('/api/journey/update-stop', ApiController.updateJourneyStop);
router.post('/api/checkin', ApiController.checkin);
router.post('/api/send-message', ApiController.sendMessage);
router.post('/api/reply-message', ensureManager, ApiController.replyMessage);
router.post('/api/festival/book', FestivalController.book);

// Workshop API (Chương 5.11)
router.post('/api/workshop/book', ensureAuthenticated, WorkshopController.book);
router.post('/api/workshop/review', ensureAuthenticated, WorkshopController.review);

// Review API (Chương 5.13)
router.post('/api/reviews', ensureAuthenticated, ReviewController.create);
router.post('/api/reviews/like', ensureAuthenticated, ReviewController.toggleLike);
router.post('/api/reviews/comment', ensureAuthenticated, ReviewController.comment);

// Profile API (Chương 5.15)
router.post('/api/redeem-reward', ensureAuthenticated, ProfileController.redeemReward);

// Cart API (Chương 5.12)
router.post('/api/cart/add', ensureAuthenticated, CartController.add);
router.post('/api/cart/update', ensureAuthenticated, CartController.update);
router.post('/api/cart/remove', ensureAuthenticated, CartController.remove);
router.post('/api/cart/checkout', ensureAuthenticated, CartController.checkout);

// Admin API (Chương 7 - Pattern Relioo apiUpdateUser, apiDeleteUser)
router.post('/api/admin/update-user', ensureAdmin, AdminController.updateUser);
router.post('/api/admin/delete-user', ensureAdmin, AdminController.deleteUser);

module.exports = router;
