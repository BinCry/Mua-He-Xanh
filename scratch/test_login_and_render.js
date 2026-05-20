const axios = require('axios');

const baseURL = 'http://localhost:3000';

async function testRole(email, password, roleLabel) {
    console.log(`\n--- TESTING ${roleLabel.toUpperCase()} LOGIN & RENDERING ---`);
    
    // Login request
    const loginRes = await axios.post(`${baseURL}/auth/login`, 
        new URLSearchParams({ email, password }).toString(),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: () => true,
            maxRedirects: 0 // Do not follow redirect so we can capture the redirect header and cookie
        }
    );

    console.log(`Login status code: ${loginRes.status}`);
    const setCookieHeaders = loginRes.headers['set-cookie'] || [];
    console.log('Set-Cookie headers received:', setCookieHeaders);

    // Extract cookie string (e.g. "bl_session=...")
    const cookies = setCookieHeaders.map(c => c.split(';')[0]).join('; ');
    console.log('Extracted cookie string:', cookies);

    const headers = { 'Cookie': cookies };

    if (roleLabel === 'admin') {
        // Test requesting /admin
        const adminDashboardRes = await axios.get(`${baseURL}/admin`, { headers, validateStatus: () => true });
        console.log(`/admin dashboard status: ${adminDashboardRes.status}`);
        if (adminDashboardRes.status !== 200) {
            console.error('ERROR: Failed to render /admin dashboard!');
            console.error(adminDashboardRes.data.substring(0, 1000));
            throw new Error('/admin failed');
        } else {
            console.log('✅ /admin dashboard rendered successfully!');
        }

        // Test requesting /manager (admin list of destinations)
        const managerListRes = await axios.get(`${baseURL}/manager`, { headers, validateStatus: () => true });
        console.log(`/manager list status: ${managerListRes.status}`);
        if (managerListRes.status !== 200) {
            console.error('ERROR: Failed to render /manager for admin!');
            console.error(managerListRes.data.substring(0, 1000));
            throw new Error('/manager list failed');
        } else {
            console.log('✅ /manager destination list (admin view) rendered successfully!');
        }

        // Test manager impersonation pages
        const match = managerListRes.data.match(/\/manager\?dest_id=([a-f0-9\-]+)/);
        if (match) {
            const destId = match[1];
            console.log(`Found destination ID to test: ${destId}`);
            
            const managerDashRes = await axios.get(`${baseURL}/manager?dest_id=${destId}`, { headers, validateStatus: () => true });
            console.log(`/manager?dest_id=${destId} status: ${managerDashRes.status}`);
            if (managerDashRes.status !== 200) {
                console.error('ERROR: Failed to render manager dashboard impersonation!');
                console.error(managerDashRes.data.substring(0, 1000));
                throw new Error('Manager dashboard impersonation failed');
            } else {
                console.log('✅ Manager dashboard impersonation rendered successfully!');
            }

            const managerChatRes = await axios.get(`${baseURL}/manager/chat?dest_id=${destId}`, { headers, validateStatus: () => true });
            console.log(`/manager/chat?dest_id=${destId} status: ${managerChatRes.status}`);
            if (managerChatRes.status !== 200) {
                console.error('ERROR: Failed to render manager chat impersonation!');
                console.error(managerChatRes.data.substring(0, 1000));
                throw new Error('Manager chat impersonation failed');
            } else {
                console.log('✅ Manager chat impersonation rendered successfully!');
            }

            const managerDestRes = await axios.get(`${baseURL}/manager/destination?dest_id=${destId}`, { headers, validateStatus: () => true });
            console.log(`/manager/destination?dest_id=${destId} status: ${managerDestRes.status}`);
            if (managerDestRes.status !== 200) {
                console.error('ERROR: Failed to render manager destination settings impersonation!');
                console.error(managerDestRes.data.substring(0, 1000));
                throw new Error('Manager destination settings impersonation failed');
            } else {
                console.log('✅ Manager destination settings impersonation rendered successfully!');
            }
        }
    } else if (roleLabel === 'manager') {
        const managerDashRes = await axios.get(`${baseURL}/manager`, { headers, validateStatus: () => true });
        console.log(`/manager dashboard status: ${managerDashRes.status}`);
        if (managerDashRes.status !== 200) {
            console.error('ERROR: Failed to render manager dashboard!');
            console.error(managerDashRes.data.substring(0, 1000));
            throw new Error('Manager dashboard failed');
        } else {
            console.log('✅ Manager dashboard rendered successfully!');
        }

        const managerChatRes = await axios.get(`${baseURL}/manager/chat`, { headers, validateStatus: () => true });
        console.log(`/manager/chat status: ${managerChatRes.status}`);
        if (managerChatRes.status !== 200) {
            console.error('ERROR: Failed to render manager chat!');
            console.error(managerChatRes.data.substring(0, 1000));
            throw new Error('Manager chat failed');
        } else {
            console.log('✅ Manager chat rendered successfully!');
        }

        const managerDestRes = await axios.get(`${baseURL}/manager/destination`, { headers, validateStatus: () => true });
        console.log(`/manager/destination status: ${managerDestRes.status}`);
        if (managerDestRes.status !== 200) {
            console.error('ERROR: Failed to render manager destination settings!');
            console.error(managerDestRes.data.substring(0, 1000));
            throw new Error('Manager destination settings failed');
        } else {
            console.log('✅ Manager destination settings rendered successfully!');
        }
    }
}

async function run() {
    await testRole('admin@binhloi.local', 'Admin@2026', 'admin');
    await testRole('manager.chua-phap-tang@binhloi.local', 'Manager@2026', 'manager');
    console.log('\n⭐⭐⭐ ALL RENDERING TESTS PASSED SUCCESSFULLY! NO TEMPLATE ERRORS FOUND. ⭐⭐⭐\n');
}

run().catch(err => {
    console.error('Test run failed with error:', err.message);
    process.exit(1);
});
