const app = require('../src/server');

module.exports = (req, res) => {
    try {
        // Intercept Express res.status(500) to return 200 with error details so read_url_content can capture it
        const originalStatus = res.status.bind(res);
        res.status = function (statusCode) {
            if (statusCode === 500) {
                console.error("Express set 500 status on path:", req.url);
                return originalStatus(200);
            }
            return originalStatus(statusCode);
        };
        return app(req, res);
    } catch (err) {
        console.error('Vercel Entry Error:', err);
        return res.status(200).send(`DEBUG ERROR AT VERCEL ENTRY: ${err.stack || err.message || err}`);
    }
};
