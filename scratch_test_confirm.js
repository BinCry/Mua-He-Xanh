const JourneyController = require('./src/controllers/JourneyController');

async function testConfirm() {
    console.log("=== TESTING JOURNEY CONFIRM ===");
    const sug = {
        id: 'ai-opt-1',
        name: 'Lộ trình AI Tối Ưu Tối Đa',
        desc: 'AI tự động chọn lọc',
        tags: ['🤖 AI Tối Ưu'],
        duration: 'Trọn 1 ngày',
        km: 4.2,
        stops: [{ id: '1', name: 'Chùa Bát Bửu Phật Đài' }],
        source: 'ai'
    };

    const req = {
        body: {
            source: 'ai',
            journeyData: Buffer.from(JSON.stringify(sug)).toString('base64')
        },
        cookies: {
            session_uuid: 'test-uuid-123456789'
        },
        user: null,
        session: {}
    };

    const res = {
        redirect: (url) => console.log(`REDIRECT TO: ${url}`)
    };

    try {
        await JourneyController.confirm(req, res);
    } catch(e) {
        console.error("EXCEPTIONAL ERROR:", e);
    }
    process.exit(0);
}

testConfirm();
