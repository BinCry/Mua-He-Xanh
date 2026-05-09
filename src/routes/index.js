const express = require('express');
const router = express.Router();
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
const { ensureAuthenticated, ensureManager, restrictToManagers } = require('../middleware/auth');

// Page Routes
router.get('/', HomeController.index);
router.get('/onboarding', OnboardingController.index);
router.get('/checkin', CheckinController.index);
router.get('/passport', ensureAuthenticated, PassportController.index);
router.get('/chat', ensureAuthenticated, ChatController.index);
router.get('/market', MarketController.index);
router.get('/festivals', FestivalController.index);
router.get('/summary', SummaryController.index);
router.get('/map', MapController.index);
router.get('/destinations', ExploreController.list);
router.get('/explore/:slug', ExploreController.show);
router.get('/audio/:slug', ExploreController.audio);
router.get('/journey', JourneyController.index);
router.get('/hanh-trinh-cua-toi', JourneyController.index);
router.get('/journey/suggestions', JourneyController.suggestions);
router.post('/journey/confirm', JourneyController.confirm);
router.get('/journey/preset/:theme', JourneyController.preset);

// Manager Routes
router.get('/manager', ensureManager, ManagerController.index);
router.post('/manager/update', ensureManager, ManagerController.updateDestination);

// Auth Routes
router.get('/auth/login', AuthController.loginPage);
router.post('/auth/login', AuthController.handleLogin);
router.post('/auth/social', AuthController.handleSocialLogin);
router.get('/auth/logout', AuthController.logout);

// API Routes
router.all('/api/session', ApiController.session);
router.all('/api/session/:uuid', ApiController.session);
router.get('/api/destinations', ApiController.destinations);
router.post('/api/journey', ApiController.journey);
router.post('/api/journey/update-stop', ApiController.updateJourneyStop);
router.post('/api/checkin', ApiController.checkin);
router.post('/api/send-message', ApiController.sendMessage);

module.exports = router;
