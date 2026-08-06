module.exports = (req, res) => {
    try {
        const app = require('../src/server');
        return app(req, res);
    } catch (err) {
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.status(200).send(`CRITICAL BOOT ERROR ON VERCEL:\n${err.stack || err.message || err}`);
    }
};
