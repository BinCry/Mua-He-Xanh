const OnboardingController = require('./src/controllers/OnboardingController');
const UserSession = require('./src/models/UserSession');

async function testSubmit() {
    console.log("=== TESTING ONBOARDING SUBMIT ===");
    const req = {
        body: {
            mood: ['chill', 'peace'],
            pax: '2',
            budget: 'mid',
            duration: 'full_day',
            date: '2026-08-15'
        },
        cookies: {
            session_uuid: 'test-uuid-123456789'
        },
        user: null,
        session: {}
    };

    const res = {
        cookie: (name, val, opts) => console.log(`Set-Cookie: ${name}=${val}`),
        json: (data) => console.log("RESPONSE JSON:", data)
    };

    try {
        await OnboardingController.submit(req, res);
    } catch(e) {
        console.error("EXCEPTIONAL ERROR:", e);
    }
    process.exit(0);
}

testSubmit();
