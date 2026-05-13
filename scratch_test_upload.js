const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testUpload() {
    const form = new FormData();
    // Create a dummy file
    const dummyPath = path.join(__dirname, 'test.txt');
    fs.writeFileSync(dummyPath, 'test content');
    
    form.append('file', fs.createReadStream(dummyPath));

    try {
        // We can't easily test because we need a session cookie for ensureAuthenticated
        console.log('Testing upload requires authentication. Manual verification needed.');
    } catch (e) {
        console.error(e);
    }
}
testUpload();
