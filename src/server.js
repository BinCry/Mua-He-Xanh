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

// Trust proxy for Render (required for secure cookies behind proxy)
app.set('trust proxy', 1);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'src', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// Middleware
app.use(cors());
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
app.use(async (req, res, next) => {
    try {
        if (!req.session?.user && req.cookies?.session_uuid) {
            const db = require('./core/database');
            const [sessions] = await db.query(
                "SELECT user_id FROM user_sessions WHERE uuid = ? ORDER BY updated_at DESC LIMIT 1",
                [req.cookies.session_uuid]
            );
            if (sessions.length > 0 && sessions[0].user_id) {
                const [users] = await db.query(
                    "SELECT * FROM users WHERE id = ? AND is_active = 1",
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
                    // Also login into passport to restore req.user & req.isAuthenticated()
                    req.login(user, (err) => {
                        if (err) console.error("Passport session restore error:", err);
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
app.use(express.static(path.join(process.cwd(), 'public')));

// Keep old image URLs working after assets were moved into /uploads/destinations.
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();

    const target = LEGACY_IMAGE_ALIASES[req.path];
    if (!target) return next();

    res.sendFile(path.join(process.cwd(), 'public', target.replace(/^\//, '')), (err) => {
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
    
    // Cache Buster for assets
    res.locals.assetV = '1.1.0_' + Date.now(); 

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
            "ALTER TABLE workshops ADD COLUMN duration VARCHAR(100) DEFAULT '2 giờ'",
            "UPDATE workshops SET duration = CONCAT(duration_minutes, ' phút') WHERE duration_minutes IS NOT NULL AND (duration IS NULL OR duration = '2 giờ')",
            // Image columns → LONGTEXT for base64 storage
            "ALTER TABLE destinations MODIFY COLUMN cover_image LONGTEXT",
            "ALTER TABLE workshops MODIFY COLUMN image LONGTEXT",
            "ALTER TABLE rewards MODIFY COLUMN image LONGTEXT",
            "ALTER TABLE events MODIFY COLUMN image LONGTEXT",
            "ALTER TABLE products MODIFY COLUMN image LONGTEXT",
            "ALTER TABLE festivals MODIFY COLUMN image LONGTEXT",
            "ALTER TABLE users MODIFY COLUMN avatar LONGTEXT",
            "ALTER TABLE settings MODIFY COLUMN key_value LONGTEXT",
            // ENUM → VARCHAR to prevent truncation errors
            "ALTER TABLE workshops MODIFY COLUMN type VARCHAR(100) DEFAULT 'other'",
            "ALTER TABLE destinations MODIFY COLUMN type VARCHAR(100) DEFAULT 'nature'",
            "ALTER TABLE rewards MODIFY COLUMN type VARCHAR(100) DEFAULT 'voucher'",
            "ALTER TABLE notifications MODIFY COLUMN type VARCHAR(100) DEFAULT 'system'",
        ];
        for (const sql of migrations) {
            try { await db.query(sql); } catch(e) { /* skip if already correct */ }
        }
        console.log('✅ Database migrations checked');
    } catch(e) {
        console.error('⚠️ Migration check failed:', e.message);
    }
}

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, async () => {
        console.log(`Server is running at http://localhost:${PORT}`);
        await runMigrations();
    });
} else {
    // Chạy migration trực tiếp khi khởi tạo trên Vercel Serverless
    runMigrations().catch(err => console.error("Vercel startup migration failed:", err));
}

module.exports = app;
