const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const passport = require('./config/passport');
const config = require('./config/env');

const app = express();
const PORT = config.port;

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

// Analytics middleware — track real page views
const analyticsMiddleware = require('./middleware/analytics');
app.use(analyticsMiddleware);

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
        fallback = fallback || '/images/placeholder.png';
        if (!imgPath || imgPath === 'undefined' || imgPath === 'NULL') return fallback;
        if (imgPath.startsWith('http')) return imgPath;
        // Strip 'public/' prefix if present
        let clean = imgPath.replace(/^public\//, '');
        if (!clean.startsWith('/')) clean = '/' + clean;
        
        // Add cache buster for fresh updates
        const v = res.locals.assetV || Date.now();
        return clean + (clean.includes('?') ? '&' : '?') + 'v=' + v;
    };

    // Load Site Settings for all templates
    const db = require('./core/database');
    db.query('SELECT * FROM settings').then(([rows]) => {
        const settings = {};
        rows.forEach(s => { settings[s.key_name] = s.key_value; });
        res.locals.settings = settings;
        next();
    }).catch(err => {
        console.error("Settings load error:", err);
        res.locals.settings = {};
        next();
    });
});

// Prevent logged in admin & manager from accessing client-facing homepage/public routes
app.use((req, res, next) => {
    const user = req.user || req.session?.user;
    if (user && req.method === 'GET') {
        const path = req.path;
        const isAsset = path.startsWith('/css') || path.startsWith('/js') || path.startsWith('/images') || path.includes('.');
        const isExcluded = path.startsWith('/admin') || path.startsWith('/manager') || path.startsWith('/auth/logout') || path.startsWith('/api') || isAsset;
        
        if (!isExcluded) {
            if (user.role === 'admin') {
                return res.redirect('/admin');
            }
            if (user.role === 'manager') {
                return res.redirect('/manager');
            }
        }
    }
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

// Auto-migrate: fix column sizes and defaults on startup
async function runMigrations() {
    try {
        const db = require('./core/database');
        const migrations = [
            // Fix text column sizes
            "ALTER TABLE destinations MODIFY COLUMN short_desc TEXT",
            "ALTER TABLE destinations MODIFY COLUMN description LONGTEXT",
            "ALTER TABLE destinations MODIFY COLUMN story LONGTEXT",
            "ALTER TABLE destinations MODIFY COLUMN highlight LONGTEXT",
            // Fix NOT NULL columns without defaults
            "ALTER TABLE destinations MODIFY COLUMN moods VARCHAR(255) NOT NULL DEFAULT '[]'",
            "ALTER TABLE destinations MODIFY COLUMN seasons VARCHAR(255) NOT NULL DEFAULT '[]'",
            "ALTER TABLE destinations MODIFY COLUMN stay_capacity ENUM('overnight','noon_rest','none') NOT NULL DEFAULT 'none'",
            "ALTER TABLE destinations MODIFY COLUMN open_hours VARCHAR(200) NOT NULL DEFAULT '08:00 - 17:00'",
            "ALTER TABLE destinations MODIFY COLUMN cost VARCHAR(300) NOT NULL DEFAULT 'Miễn phí'",
            "ALTER TABLE destinations MODIFY COLUMN lat DECIMAL(10,7) NOT NULL DEFAULT 10.825",
            "ALTER TABLE destinations MODIFY COLUMN lng DECIMAL(10,7) NOT NULL DEFAULT 106.72",
            "ALTER TABLE destinations MODIFY COLUMN best_time VARCHAR(255) NOT NULL DEFAULT 'Quanh năm'",
            "ALTER TABLE destinations MODIFY COLUMN checkin_tip VARCHAR(500) NOT NULL DEFAULT 'Hãy chụp ảnh tại điểm này!'",
            "ALTER TABLE destinations MODIFY COLUMN qr_secret VARCHAR(255) NOT NULL DEFAULT ''",
            "ALTER TABLE destinations MODIFY COLUMN map_x INT NOT NULL DEFAULT 50",
            "ALTER TABLE destinations MODIFY COLUMN map_y INT NOT NULL DEFAULT 50",
            "ALTER TABLE destinations MODIFY COLUMN radius_meter INT NOT NULL DEFAULT 100",
        ];
        for (const sql of migrations) {
            try { await db.query(sql); } catch(e) { /* skip if already correct */ }
        }
        console.log('✅ Database migrations checked');
    } catch(e) {
        console.error('⚠️ Migration check failed:', e.message);
    }
}

app.listen(PORT, async () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    await runMigrations();
});
