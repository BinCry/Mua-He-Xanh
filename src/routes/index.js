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

// Page Routes
router.get('/', HomeController.index);
router.get('/onboarding', OnboardingController.index);
router.get('/checkin', CheckinController.index);
router.get('/summary', SummaryController.index);
router.get('/map', MapController.index);
router.get('/destinations', ExploreController.list);
router.get('/explore/:slug', ExploreController.show);
router.get('/journey', JourneyController.index);
router.get('/journey/preset/:theme', JourneyController.preset);

// API Routes
router.all('/api/session/:uuid?', ApiController.session);
router.get('/api/destinations', ApiController.destinations);
router.post('/api/journey', ApiController.journey);
router.post('/api/checkin', ApiController.checkin);

module.exports = router;
