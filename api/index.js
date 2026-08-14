let app;

module.exports = (req, res) => {
    try {
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
