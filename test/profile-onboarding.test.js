const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('journey routes retire the preference form in favor of the tour catalogue', () => {
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    const tourList = fs.readFileSync('src/views/journey/tours.ejs', 'utf8');
    const tourDetail = fs.readFileSync('src/views/journey/tour_detail.ejs', 'utf8');

    assert.match(routes, /res\.redirect\('\/journey\/tours'\)/);
    assert.match(routes, /router\.get\(\['\/journey\/tours', '\/journey\/tours\/'\], ensureAuthenticated, JourneyController\.tours\)/);
    assert.match(routes, /router\.get\('\/journey\/tours\/:id', ensureAuthenticated, JourneyController\.tourDetail\)/);
    assert.match(routes, /router\.post\('\/api\/admin\/toggle-journey-template', ensureAdmin, AdminController\.toggleJourneyTemplate\)/);
    assert.match(tourList, /href="\/journey\/tours\/<%= tour\.id %>"/);
    assert.match(tourDetail, /name="templateId" value="<%= tour\.id %>"/);
    assert.doesNotMatch(tourList, /TOUR BÌNH LỢI/);
});

test('profile queries use PostgreSQL session columns and do not require a rewards.type column', () => {
    const source = fs.readFileSync('src/controllers/ProfileController.js', 'utf8');
    assert.match(source, /j\.session_id = us\.id::text OR j\.session_id = us\.uuid/);
    assert.doesNotMatch(source, /j\.session_id = us\.session_uuid/);
    assert.doesNotMatch(source, /r\.type/);
});

test('reward history uses the user_rewards created_at schema column', () => {
    const controller = fs.readFileSync('src/controllers/ProfileController.js', 'utf8');
    const rewardsView = fs.readFileSync('src/views/profile/rewards.ejs', 'utf8');
    assert.match(controller, /ORDER BY ur\.created_at DESC/);
    assert.doesNotMatch(controller, /ur\.redeemed_at/);
    assert.match(rewardsView, /r\.created_at/);
    assert.doesNotMatch(rewardsView, /r\.redeemed_at/);
});
