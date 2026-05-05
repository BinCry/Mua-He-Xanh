const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

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
        secure: process.env.NODE_ENV === 'production' 
    }
}));

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Global variables for templates
app.use((req, res, next) => {
    res.locals.baseUrl = process.env.APP_URL || `http://localhost:${PORT}`;
    res.locals.appName = 'Bình Lợi Healing';
    res.locals.session = req.session;
    next();
});

// Routes
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// 404 handler
app.use((req, res) => {
    res.status(404).render('errors/404', { title: '404 - Không tìm thấy' });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});
