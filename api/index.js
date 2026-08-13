let app;

module.exports = (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        if (!app) {
            app = require('../src/server');
        }
        return app(req, res);
    } catch (err) {
        console.error('Vercel Entry Error:', err);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Internal Server Error: ' + (err.message || String(err)));
    }
};
