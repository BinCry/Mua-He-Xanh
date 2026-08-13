const JourneyController = require('./src/controllers/JourneyController');

async function testIndex() {
    console.log("=== TESTING JOURNEY INDEX (/hanh-trinh-cua-toi) ===");
    const req = {
        query: {},
        cookies: {
            session_uuid: 'test-uuid-123456789'
        },
        user: null,
        session: {}
    };

    const res = {
        render: (view, data) => console.log(`RENDER VIEW SUCCESS: ${view}, journey: ${data.journey?.id}, stops: ${data.journey?.stops?.length}`),
        redirect: (url) => console.log(`REDIRECT TO: ${url}`)
    };

    try {
        await JourneyController.index(req, res);
    } catch(e) {
        console.error("EXCEPTIONAL ERROR IN INDEX:", e);
    }
    process.exit(0);
}

testIndex();
