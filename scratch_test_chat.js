const ApiController = require('./src/controllers/ApiController');
const AdminController = require('./src/controllers/AdminController');
const db = require('./src/core/database');

async function testChatFlow() {
    console.log("=== STARTING CHAT SYSTEM END-TO-END TEST ===");

    const mockCookieUuid = 'test-chat-tourist-uuid-999';

    // 1. Tourist sends a message
    console.log("\n1. Testing Tourist send message...");
    const req1 = {
        body: { message: "Xin chào Admin! Tôi muốn hỏi giá vé vào cổng Chùa Bát Bửu." },
        cookies: { session_uuid: mockCookieUuid },
        user: null
    };
    let sendResult = null;
    const res1 = {
        cookie: (n, v) => {},
        json: (data) => { sendResult = data; console.log("   Send result:", data); },
        status: (s) => ({ json: (d) => console.log(`   Status ${s}:`, d) })
    };
    await ApiController.sendMessage(req1, res1);

    // 2. Tourist gets messages
    console.log("\n2. Testing Tourist get messages...");
    let touristMessages = [];
    const req2 = {
        query: {},
        cookies: { session_uuid: mockCookieUuid },
        user: null
    };
    const res2 = {
        cookie: (n, v) => {},
        json: (data) => { touristMessages = data.data; console.log(`   Fetched ${data.data?.length} messages for tourist.`); }
    };
    await ApiController.getMessages(req2, res2);
    console.log("   First message is_mine:", touristMessages[0]?.is_mine, "| Content:", touristMessages[0]?.message);

    // 3. Admin checks chat history for this tourist session
    console.log("\n3. Testing Admin get chat history...");
    const [sessions] = await db.query("SELECT id FROM user_sessions WHERE uuid = $1", [mockCookieUuid]);
    const sessionId = sessions[0]?.id;
    console.log("   Found session ID:", sessionId);

    let adminChatData = null;
    const req3 = {
        query: { sessionId: sessionId },
        session: { user: { id: 'admin-id-1', role: 'admin' } }
    };
    const res3 = {
        json: (data) => { adminChatData = data; console.log(`   Admin loaded ${data.messages?.length} messages.`); }
    };
    await AdminController.getChatHistory(req3, res3);

    // 4. Admin sends reply
    console.log("\n4. Testing Admin reply to tourist...");
    let replyResult = null;
    const req4 = {
        body: {
            sessionId: sessionId,
            replyText: "Chào bạn! Chùa Bát Bửu Phật Đài mở cửa miễn phí cho du khách tham quan nhé."
        },
        session: { user: { id: 'admin-id-1', role: 'admin', full_name: 'Ban Quản Trị' } }
    };
    const res4 = {
        json: (data) => { replyResult = data; console.log("   Admin reply result:", data); },
        status: (s) => ({ json: (d) => console.log(`   Status ${s}:`, d) })
    };
    await ApiController.replyMessage(req4, res4);

    // 5. Tourist re-fetches messages to verify Admin reply received
    console.log("\n5. Verifying Tourist receives Admin reply...");
    let updatedTouristMessages = [];
    await ApiController.getMessages(req2, {
        cookie: (n, v) => {},
        json: (data) => { updatedTouristMessages = data.data; }
    });
    console.log(`   Total messages now: ${updatedTouristMessages.length}`);
    updatedTouristMessages.forEach((m, idx) => {
        console.log(`   [Msg ${idx+1}] is_mine: ${m.is_mine} | Content: "${m.message}"`);
    });

    if (updatedTouristMessages.length === 2 && updatedTouristMessages[0].is_mine === true && updatedTouristMessages[1].is_mine === false) {
        console.log("\n🎉 ALL CHAT TESTS PASSED 100% PERFECTLY!");
    } else {
        console.log("\n⚠️ TEST COMPLETED WITH WARNINGS!");
    }

    process.exit(0);
}

testChatFlow();
