const express = require('express');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const passport = require('./config/passport');
const config = require('./config/env');
const UserSession = require('./models/UserSession');
const { LEGACY_IMAGE_ALIASES, DEFAULT_IMAGE, normalizeImagePath } = require('./utils/imagePaths');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = config.port;

// Health check route - bypasses DB/session to verify Vercel serverless boot
app.get('/api/health', async (req, res) => {
    const info = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        db_url_set: !!process.env.DATABASE_URL,
        db_url_prefix: (process.env.DATABASE_URL || '').substring(0, 30) + '...',
        vercel: !!process.env.VERCEL
    };
    
    // Test actual DB connection
    try {
        const db = require('./core/database');
        const [rows] = await db.query('SELECT NOW() as time');
        info.db_connected = true;
        info.db_time = rows[0]?.time;
    } catch (dbErr) {
        info.db_connected = false;
        info.db_error = dbErr.message;
        info.db_code = dbErr.code;
    }
    
    res.json(info);
});

// Root directory - works on both local and Vercel serverless
const ROOT_DIR = path.join(__dirname, '..');



// Trust proxy for Render (required for secure cookies behind proxy)
app.set('trust proxy', 1);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT_DIR, 'src', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(cors());

const compression = require('compression');
app.use(compression());

// High-speed Edge CDN: serves instantly from Edge, refreshes in background (user always sees fresh data)
app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/admin') && !req.path.startsWith('/manager') && !req.path.startsWith('/auth') && !req.path.startsWith('/profile')) {
        res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    } else {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

// Session auto-restoration: recovers session from DB if express-session is lost but session_uuid cookie exists
// Critical for Vercel serverless where MemoryStore sessions are lost between instances
app.use(async (req, res, next) => {
    try {
        if (!req.session?.user && req.cookies?.session_uuid) {
            const db = require('./core/database');
            const [sessions] = await db.query(
                "SELECT user_id FROM user_sessions WHERE uuid = $1 ORDER BY updated_at DESC LIMIT 1",
                [req.cookies.session_uuid]
            );
            if (sessions.length > 0 && sessions[0].user_id) {
                const [users] = await db.query(
                    "SELECT * FROM users WHERE id = $1 AND is_active = 1",
                    [sessions[0].user_id]
                );
                if (users.length > 0) {
                    const user = users[0];
                    req.session.user = {
                        id: user.id,
                        email: user.email,
                        full_name: user.full_name,
                        role: user.role,
                        avatar: user.avatar,
                        phone: user.phone,
                        managed_destination_id: user.managed_destination_id
                    };
                    // MUST await req.login to ensure req.user is set BEFORE next() runs
                    await new Promise((resolve) => {
                        req.login(user, (err) => {
                            if (err) console.error("Passport session restore error:", err);
                            resolve();
                        });
                    });
                }
            }
        }
    } catch (e) {
        console.error("Session auto-restore warning:", e.message);
    }
    next();
});

// Analytics middleware - track real page views
const analyticsMiddleware = require('./middleware/analytics');
app.use(analyticsMiddleware);

// Static files
app.use(express.static(path.join(ROOT_DIR, 'public')));

// Keep old image URLs working after assets were moved into /uploads/destinations.
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const target = LEGACY_IMAGE_ALIASES[req.path];
    if (!target) return next();

    res.sendFile(path.join(ROOT_DIR, 'public', target.replace(/^\//, '')), (err) => {
        if (err) next();
    });
});

// Global variables for templates
app.use(async (req, res, next) => {
    // Dynamic Base URL detection (Prioritize current request host for local testing)
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host');
    const autoBaseUrl = `${protocol}://${host}`;
    
    // Use env BASE_URL only if we are in production and it's set
    const baseUrl = (process.env.NODE_ENV === 'production' && process.env.BASE_URL) 
        ? process.env.BASE_URL 
        : autoBaseUrl;

    res.locals.baseUrl = baseUrl;
    res.locals.appName = 'Bình Lợi - Miền Tây giữa lòng Sài Gòn';
    res.locals.session = req.session;
    res.locals.user = req.user || req.session.user || null;
    res.locals.currentPath = req.path;
    
    // Cache Buster for assets
    res.locals.assetV = '1.5.0_' + Date.now(); 

    res.locals.fixImg = (imgPath, fallback) => {
        const clean = normalizeImagePath(imgPath, fallback || DEFAULT_IMAGE);
        if (clean.startsWith('http') || clean.startsWith('data:')) return clean;

        // Add cache buster for fresh updates
        const v = res.locals.assetV || Date.now();
        return clean + (clean.includes('?') ? '&' : '?') + 'v=' + v;
    };

    // Ensure session_uuid exists and fetch its DB row ID
    res.locals.sessionDbId = null;
    res.locals.sessionDbUuid = null;
    try {
        let sessionUuid = req.cookies?.session_uuid;
        if (!sessionUuid) {
            sessionUuid = uuidv4();
            res.cookie('session_uuid', sessionUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
            req.cookies = req.cookies || {};
            req.cookies.session_uuid = sessionUuid;
        }
        
        const sessionRow = await UserSession.findOrCreate(sessionUuid, req);
        if (sessionRow) {
            res.locals.sessionDbId = sessionRow.id;
            res.locals.sessionDbUuid = sessionRow.uuid;
        }
    } catch (e) {
        console.error("Session initialize middleware error:", e);
    }

    // Load Site Settings for all templates
    const db = require('./core/database');
    db.query('SELECT * FROM settings').then(([rows]) => {
        const settings = {};
        if (Array.isArray(rows)) {
            rows.forEach(s => { if (s && s.key_name) settings[s.key_name] = s.key_value; });
        }
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
    res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: err.message || String(err),
        stack: err.stack
    });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}

module.exports = app;
