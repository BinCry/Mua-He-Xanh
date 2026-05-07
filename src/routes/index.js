const express = require('express');
const router = express.Router();
const HomeController = require('../controllers/HomeController');
const ApiController = require('../controllers/ApiController');

const ExploreController = require('../controllers/ExploreController');
const CheckinController = require('../controllers/CheckinController');
const SummaryController = require('../controllers/SummaryController');
const MapController = require('../controllers/MapController');

const ManagerController = require('../controllers/ManagerController');
const AuthController = require('../controllers/AuthController');
const { ensureAuthenticated, ensureManager, restrictToManagers } = require('../middleware/auth');

// Page Routes
router.get('/', HomeController.index);
router.get('/checkin', CheckinController.index);
router.get('/summary', SummaryController.index);
router.get('/map', MapController.index);
router.get('/destinations', ExploreController.list);
router.get('/explore/:slug', ExploreController.show);

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
router.post('/api/checkin', ApiController.checkin);
router.post('/api/send-message', ApiController.sendMessage);

module.exports = router;
