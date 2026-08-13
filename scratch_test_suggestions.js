const JourneyController = require('./src/controllers/JourneyController');

async function testSuggestions() {
    console.log("=== TESTING JOURNEY SUGGESTIONS ===");
    const req = {
        cookies: {
            session_uuid: 'test-uuid-123456789'
        },
        user: null,
        session: {}
    };

    const res = {
        cookie: (name, val, opts) => console.log(`Set-Cookie: ${name}=${val}`),
        render: (view, data) => console.log(`RENDER VIEW: ${view}, title: ${data.title}, aiSuggestions: ${data.aiSuggestions?.length}, templateSuggestions: ${data.templateSuggestions?.length}`),
        redirect: (url) => console.log(`REDIRECT TO: ${url}`)
    };

    try {
        await JourneyController.suggestions(req, res);
    } catch(e) {
        console.error("EXCEPTIONAL ERROR:", e);
    }
    process.exit(0);
}

testSuggestions();
