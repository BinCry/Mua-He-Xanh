const https = require('https');
const http = require('http');
const url = require('url');

// First, test if the /api/upload endpoint responds
const testUrl = 'https://www.dulichbinhloi.com/api/upload';

const req = https.request(testUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', body.substring(0, 500));
    });
});

req.on('error', (err) => {
    console.error('Request error:', err.message);
});

req.write('{}');
req.end();
