const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const passport = require('./config/passport');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render (required for secure cookies behind proxy)
app.set('trust proxy', 1);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    name: 'bl_session',
    secret: process.env.SESSION_SECRET || 'binh_loi_secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 604800000, // 7 days
        secure: false // Set to false for compatibility
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Global variables for templates
app.use((req, res, next) => {
    // Dynamic Base URL detection (Prioritize current request host for local testing)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const autoBaseUrl = `${protocol}://${host}`;
    
    // Use env BASE_URL only if we are in production and it's set
    const baseUrl = (process.env.NODE_ENV === 'production' && process.env.BASE_URL) 
        ? process.env.BASE_URL 
        : autoBaseUrl;

    res.locals.baseUrl = baseUrl;
    res.locals.appName = 'Bình Lợi – Miền Tây giữa lòng Sài Gòn';
    res.locals.session = req.session;
    res.locals.user = req.user || req.session.user || null;
    
    // Cache Buster for assets
    res.locals.assetV = '1.1.0_' + Date.now(); 

    // Helper: fix image paths from database (strips 'public/' prefix)
    res.locals.fixImg = (imgPath, fallback) => {
        fallback = fallback || '/images/hero-2.png';
        if (!imgPath) return fallback;
        if (imgPath.startsWith('http')) return imgPath;
        // Strip 'public/' prefix if present
        let clean = imgPath.replace(/^public\//, '');
        if (!clean.startsWith('/')) clean = '/' + clean;
        return clean;
    };

    next();
});

// Routes
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).render('errors/404', { title: '404 - Không tìm thấy' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).send('Internal Server Error: ' + err.message);
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
