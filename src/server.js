const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const expressLayouts = require('express-ejs-layouts');
const passport = require('./config/passport');
const config = require('./config/env');
const UserSession = require('./models/UserSession');
const CheckIn = require('./models/CheckIn');
const { LEGACY_IMAGE_ALIASES, DEFAULT_IMAGE, normalizeImagePath } = require('./utils/imagePaths');
const { safeJsonForScript } = require('./utils/safeJson');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = config.port;

// Baseline browser hardening that does not require a third-party middleware.
// Keep CSP out of this minimal layer until every legacy CDN dependency is
// migrated, rather than shipping a policy that silently breaks key screens.
app.disable('x-powered-by');
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (process.env.NODE_ENV === 'production' && req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// Liveness must be fast and must not disclose configuration or wait for the DB.
app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Readiness is intentionally separate so deploy checks can verify the database.
app.get('/api/ready', async (req, res) => {
    try {
        const db = require('./core/database');
        await db.query('SELECT 1');
        res.set('Cache-Control', 'no-store');
        res.json({ status: 'ready', timestamp: new Date().toISOString() });
    } catch (error) {
        res.set('Cache-Control', 'no-store');
        res.status(503).json({ status: 'not_ready' });
    }
});

// Legacy schema patches must never mutate a production database merely because
// an instance starts. Use an explicit migration command for deployment; this
// compatibility path is opt-in for local development only.
const allowLegacySchemaAutopatch = process.env.NODE_ENV !== 'production' &&
    process.env.ALLOW_LEGACY_SCHEMA_AUTOPATCH === 'true';
if (allowLegacySchemaAutopatch && !global._dbPatched) {
    global._dbPatched = true;
    (async () => {
        try {
            const db = require('./core/database');
            await Promise.all([
                db.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS guest_uuid VARCHAR(255)`),
                db.query(`ALTER TABLE review_comments ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255)`),
                db.query(`ALTER TABLE review_likes ADD COLUMN IF NOT EXISTS guest_uuid VARCHAR(255)`),
                db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS message TEXT`),
                db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_ai INTEGER DEFAULT 0`),
                db.query(`ALTER TABLE destinations ADD COLUMN IF NOT EXISTS banner_image TEXT`),
                db.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_image TEXT`),
                db.query(`ALTER TABLE destinations ALTER COLUMN checkin_tip TYPE TEXT`),
                db.query(`ALTER TABLE destinations ALTER COLUMN audio_url TYPE TEXT`),
                db.query(`ALTER TABLE destinations ALTER COLUMN video_url TYPE TEXT`),
                db.query(`ALTER TABLE destinations ALTER COLUMN zen_walk_desc TYPE TEXT`),
                db.query(`ALTER TABLE destinations ALTER COLUMN open_hours TYPE TEXT`),
                db.query(`ALTER TABLE destinations ALTER COLUMN cost TYPE TEXT`),
                db.query(`ALTER TABLE destinations ALTER COLUMN best_time TYPE TEXT`),
                db.query(`ALTER TABLE destinations ALTER COLUMN radius_meter SET DEFAULT 2000`),
                db.query(`UPDATE destinations SET radius_meter = 2000 WHERE radius_meter IS DISTINCT FROM 2000`),
                db.query(`ALTER TABLE events ALTER COLUMN description TYPE TEXT`),
                db.query(`ALTER TABLE workshops ALTER COLUMN description TYPE TEXT`),
                db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_recalled INTEGER DEFAULT 0`),
                db.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for TEXT DEFAULT ''`),
                db.query(`
                    CREATE TABLE IF NOT EXISTS hero_posters (
                        id VARCHAR(36) PRIMARY KEY,
                        title VARCHAR(255),
                        image_url TEXT NOT NULL,
                        sort_order INT DEFAULT 0,
                        is_active INT DEFAULT 1,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)
            ]);

            // One-time, idempotent repair for check-ins created before points
            // were synchronized with the linked user account.
            await CheckIn.backfillLinkedUserPoints();

            // Initialize video templates table and seed defaults
            const VideoTemplate = require('./models/VideoTemplate');
            await VideoTemplate.ensureTableExists();
        } catch(e) {
            console.warn('Auto DB schema patch error:', e.message);
        }
    })();
}

// Root directory - works on both local and Vercel serverless
const ROOT_DIR = path.join(__dirname, '..');

// Trust proxy for Render (required for secure cookies behind proxy)
app.set('trust proxy', 1);

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(ROOT_DIR, 'src', 'views'));
app.use(expressLayouts);
app.set('layout', 'layouts/main');

// This application serves its API and pages from the same origin. Do not
// reflect arbitrary origins; cross-site callers must be explicitly enabled
// through CORS_ORIGIN at deployment time.
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean) : false;
app.use(cors({ origin: corsOrigin }));

const compression = require('compression');
app.use(compression());

// ========================================================================
// STATIC FILES — served BEFORE session/cookie middleware for zero overhead
// ========================================================================
// This screen belongs to the Service Worker recovery flow. A direct request
// while the server is available should always take visitors back home.
app.get('/offline.html', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.redirect(302, '/');
});

// The browser must revalidate this file so PWA recovery behavior updates promptly.
app.get('/sw.js', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.sendFile(path.join(ROOT_DIR, 'public', 'sw.js'));
});

// Operational exports can contain personal or analytics data and must never be
// exposed by the public static-file middleware.
app.use('/exports', (req, res) => {
    res.status(404).end();
});

// Icon fonts are a production dependency, not a runtime CDN dependency. This
// also keeps navigation labels and action icons available during a degraded
// internet connection.
app.use('/vendor/bootstrap-icons', express.static(path.join(ROOT_DIR, 'node_modules', 'bootstrap-icons', 'font'), {
    maxAge: '365d',
    immutable: true
}));

app.use(express.static(path.join(ROOT_DIR, 'public'), {
    maxAge: '365d',
    immutable: true
}));

// Keep old image URLs working after assets were moved into /uploads/destinations.
app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const target = LEGACY_IMAGE_ALIASES[req.path];
    if (!target) return next();
    const targetFile = path.join(ROOT_DIR, 'public', target.replace(/^\//, ''));
    if (fs.existsSync(targetFile)) {
        return fs.createReadStream(targetFile).pipe(res);
    }
    next();
});

// Smart media sync: If an uploaded image doesn't exist on local disk, proxy it directly from live VPS
app.use('/uploads', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const localFile = path.join(ROOT_DIR, 'public', 'uploads', req.path.replace(/^\//, ''));
    if (fs.existsSync(localFile)) {
        return fs.createReadStream(localFile).pipe(res);
    }
    const host = req.get('host') || '';
    if (!host.includes('dulichbinhloi.com')) {
        const liveUrl = `https://www.dulichbinhloi.com/uploads${req.path}`;
        // Keep Node's certificate verification enabled.  This fallback reads
        // public media from the canonical host, but must not turn a TLS error
        // into an opportunity for a man-in-the-middle response.
        const proxyReq = https.get(liveUrl, (proxyRes) => {
            if (proxyRes.statusCode === 200) {
                res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/png');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                return proxyRes.pipe(res);
            }
            return next();
        });
        proxyReq.on('error', () => next());
        return;
    }
    next();
});

// Force 301 redirect from *.vercel.app to custom domain www.dulichbinhloi.com
app.use((req, res, next) => {
    const host = req.get('host') || '';
    if (host.includes('vercel.app')) {
        return res.redirect(301, 'https://www.dulichbinhloi.com' + req.originalUrl);
    }
    next();
});

// ========================================================================
// PUBLIC CACHEABLE PAGES — bypass session/cookie for Edge CDN compatibility
// Set-Cookie headers prevent Vercel Edge CDN from caching responses.
// For public pages, we skip session middleware entirely.
// ========================================================================
const PUBLIC_CACHEABLE_PATHS = new Set(['/', '/explore', '/shops', '/festivals', '/map', '/reviews']);

function isPublicCacheablePath(p) {
    return PUBLIC_CACHEABLE_PATHS.has(p) || p.startsWith('/explore/') || p.startsWith('/shops/');
}

// Cache-Control headers
app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    const p = req.path.toLowerCase();
    
    // Service Worker and Manifest must NEVER be cached by browser or CDN
    if (p === '/sw.js' || p === '/manifest.json') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return next();
    }

    if (p.match(/\.(css|js|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot)$/)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
        // Anonymous HTML may be revalidated and restored by browser navigation.
        // Sensitive responses are tightened again after authentication resolves.
        res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
    }
    next();
});

// Body parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(cookieParser());

// Real-time Analytics: Start New Tab-Session / Visit
app.post('/api/analytics/session-start', async (req, res) => {
    try {
        const sessionId = req.body?.tabSession || req.cookies?.tab_session_id || req.cookies?.session_uuid || 'anonymous';
        const pageUrl = req.body?.path || '/';
        const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || 'unknown';
        const userAgent = (req.headers['user-agent'] || '').substring(0, 500);

        const db = require('./core/database');
        const { v4: uuidv4 } = require('uuid');
        await db.query(
            `INSERT INTO analytics (id, session_id, event, page_url, user_agent, duration_ms, ip_address, created_at, updated_at) 
             VALUES ($1, $2, 'session_start', $3, $4, 0, $5, NOW(), NOW())`,
            [uuidv4(), sessionId, pageUrl, userAgent, ip]
        );
        res.status(204).end();
    } catch (e) {
        res.status(204).end();
    }
});

// Real-time Analytics Heartbeat / Time-on-site Endpoint
app.post('/api/analytics/heartbeat', async (req, res) => {
    try {
        const sessionId = req.body?.sessionId || req.cookies?.tab_session_id || req.cookies?.session_uuid || req.ip || 'anonymous';
        const seconds = Math.min(parseInt(req.body?.seconds) || 0, 7200);
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || req.ip || 'unknown';
        const userAgent = (req.headers['user-agent'] || '').substring(0, 500);

        if (seconds > 0) {
            const db = require('./core/database');
            const { v4: uuidv4 } = require('uuid');

            // 1. Update duration for current session
            await db.query(
                `UPDATE analytics SET duration_ms = $1, updated_at = NOW() 
                 WHERE id = (
                     SELECT id FROM analytics 
                     WHERE session_id = $2 AND event = 'session_start' 
                     ORDER BY created_at DESC LIMIT 1
                 )`,
                [seconds * 1000, sessionId]
            );

            // 2. Continuous 30-minute stay rule: Every 1800s triggers +1 visit
            const intervals = Math.floor(seconds / 1800);
            if (intervals > 0) {
                const [existingMilestones] = await db.query(
                    `SELECT COUNT(*) as cnt FROM analytics 
                     WHERE session_id = $1 AND event = 'session_start' AND metadata = $2`,
                    [sessionId, `30m_milestone_${intervals}`]
                );
                if (parseInt(existingMilestones[0]?.cnt || 0, 10) === 0) {
                    await db.query(
                        `INSERT INTO analytics (id, session_id, event, page_url, user_agent, duration_ms, ip_address, metadata, created_at, updated_at) 
                         VALUES ($1, $2, 'session_start', $3, $4, 0, $5, $6, NOW(), NOW())`,
                        [uuidv4(), sessionId, req.body?.path || '/', userAgent, ip, `30m_milestone_${intervals}`]
                    );
                }
            }
        }
        res.status(204).end();
    } catch (e) {
        res.status(204).end();
    }
});

// ========================================================================
// SESSION & PASSPORT — initialized globally on all routes for 100% reliable login state
// ========================================================================
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required in production.');
}

const sessionMiddleware = session({
    name: 'bl_session',
    // The development fallback is deliberately unusable in production.
    secret: process.env.SESSION_SECRET || 'development-only-session-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 604800000, // 7 days
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax'
    }
});

app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());
app.use(require('./middleware/sameOrigin'));
app.use(require('./middleware/sanitizeServerErrors'));

// Session auto-restoration: recovers session from DB if express-session is lost
// Only runs when session middleware was activated (non-public routes)
app.use(async (req, res, next) => {
    if (!req.session) return next();
    try {
        if (req.cookies?.session_uuid && !req.session?.user && !req.session?.sessionChecked) {
            req.session.sessionChecked = true;
            const db = require('./core/database');
            const [sessions] = await db.query(
                `SELECT user_id FROM user_sessions
                 WHERE uuid = $1 AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
                 ORDER BY updated_at DESC LIMIT 1`,
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

// Personalized/admin pages stay out of browser history caches. Public pages can
// still use normal revalidation and BFCache for faster back/forward navigation.
app.use((req, res, next) => {
    const sensitivePrefixes = ['/admin', '/manager', '/auth', '/profile', '/passport', '/journey', '/onboarding', '/checkin', '/chat'];
    const isSensitive = Boolean(req.user || req.session?.user) || sensitivePrefixes.some(prefix => req.path.startsWith(prefix));
    if (isSensitive) {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

// Analytics middleware - track real page views (fire-and-forget, non-blocking)
const analyticsMiddleware = require('./middleware/analytics');
app.use(analyticsMiddleware);

// ========================================================================
// GLOBAL TEMPLATE VARIABLES
// ========================================================================
app.use(async (req, res, next) => {
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.get('host') || '';
    let autoBaseUrl = `${protocol}://${host}`;
    if (host.includes('vercel.app')) {
        autoBaseUrl = 'https://www.dulichbinhloi.com';
    }
    
    const baseUrl = (process.env.NODE_ENV === 'production') 
        ? (process.env.BASE_URL || 'https://www.dulichbinhloi.com') 
        : autoBaseUrl;

    res.locals.baseUrl = baseUrl;
    res.locals.appName = 'Bình Lợi - Miền Tây giữa lòng Sài Gòn';
    res.locals.session = req.session || {};
    res.locals.user = req.user || req.session?.user || null;
    res.locals.currentPath = req.path;
    res.locals.safeJsonForScript = safeJsonForScript;
    
    // Cache Buster for assets
    // Bump together with visual/font releases so browser and PWA caches never
    // keep an older stylesheet with incomplete Vietnamese glyph coverage.
    res.locals.assetV = '117.0.0';

    res.locals.fixImg = (imgPath, fallback) => {
        const clean = normalizeImagePath(imgPath, fallback || DEFAULT_IMAGE);
        if (clean.startsWith('http') || clean.startsWith('data:')) return clean;
        if (clean.startsWith('/uploads/media/')) {
            return `https://www.dulichbinhloi.com${clean}`;
        }
        const v = res.locals.assetV;
        return clean + (clean.includes('?') ? '&' : '?') + 'v=' + v;
    };

    // Session UUID + DB row — only for non-public routes (requires session)
    res.locals.sessionDbId = null;
    res.locals.sessionDbUuid = null;
    const statefulPrefixes = ['/journey', '/onboarding', '/checkin', '/passport', '/profile', '/chat'];
    const needsSessionRecord = Boolean(req.session?.user) || statefulPrefixes.some(prefix => req.path.startsWith(prefix));
    if (needsSessionRecord && req.session) {
        try {
            let sessionUuid = req.cookies?.session_uuid;
            if (!sessionUuid) {
                sessionUuid = uuidv4();
                res.cookie('session_uuid', sessionUuid, { maxAge: 86400 * 30 * 1000, httpOnly: true });
                req.cookies = req.cookies || {};
                req.cookies.session_uuid = sessionUuid;
            }
            
            if (req.session.sessionDbId && req.session.sessionDbUuid === sessionUuid) {
                res.locals.sessionDbId = req.session.sessionDbId;
                res.locals.sessionDbUuid = req.session.sessionDbUuid;
            } else {
                const sessionRow = await UserSession.findOrCreate(sessionUuid, req);
                if (sessionRow) {
                    res.locals.sessionDbId = sessionRow.id;
                    res.locals.sessionDbUuid = sessionRow.uuid;
                    req.session.sessionDbId = sessionRow.id;
                    req.session.sessionDbUuid = sessionRow.uuid;
                }
            }
        } catch (e) {
            console.error("Session initialize middleware error:", e);
        }
    }

    // Load Site Settings with RAM caching (2 minutes TTL)
    const now = Date.now();
    if (global._settingsCache && (now - global._settingsCacheTime < 120000)) {
        res.locals.settings = global._settingsCache;
        return next();
    }

    const db = require('./core/database');
    db.query('SELECT * FROM settings').then(([rows]) => {
        const settings = {};
        if (Array.isArray(rows)) {
            rows.forEach(s => { if (s && s.key_name) settings[s.key_name] = s.key_value; });
        }
        global._settingsCache = settings;
        global._settingsCacheTime = Date.now();
        res.locals.settings = settings;
        next();
    }).catch(err => {
        console.error("Settings load error:", err);
        res.locals.settings = global._settingsCache || {};
        next();
    });
});

// Prevent logged in admin & manager from accessing client-facing homepage/public routes
app.use((req, res, next) => {
    const user = req.user || req.session?.user;
    if (user && req.method === 'GET') {
        const path = req.path;
        const isAsset = path.startsWith('/css') || path.startsWith('/js') || path.startsWith('/images') || path.includes('.');
        // Staff can preview these public catalogue/event pages.  Keep all
        // operational and mutation routes inside the role-specific panels.
        const isPublicPreview = path === '/shops' || path.startsWith('/shops/') ||
            path === '/workshops' || path.startsWith('/workshops/') ||
            path === '/festivals';
        const isExcluded = path.startsWith('/admin') || path.startsWith('/manager') || path.startsWith('/auth') || path.startsWith('/api') || isAsset || isPublicPreview;
        
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
        message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'
    });
});

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    if (process.env.NODE_ENV === 'production' && !String(process.env.DATABASE_URL || '').trim()) {
        console.error('DATABASE_URL is required in production. Refusing to start without database configuration.');
        process.exit(1);
    }
    app.listen(PORT, () => {
        console.log(`Server is running at http://localhost:${PORT}`);
    });
}

module.exports = app;
