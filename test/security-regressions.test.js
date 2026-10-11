const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('public rich descriptions are escaped instead of emitting stored HTML', () => {
    for (const file of ['src/views/shop/show.ejs', 'src/views/events/show.ejs', 'src/views/explore/show.ejs']) {
        const source = fs.readFileSync(file, 'utf8');
        assert.doesNotMatch(source, /<%-\s*\(?(?:workshop\.description|event\.description|dest\.story)/);
        assert.match(source, /white-space:\s*pre-line/);
    }
});

test('review comments are built with DOM text nodes rather than interpolated user content', () => {
    const source = fs.readFileSync('src/views/reviews/index.ejs', 'utf8');
    assert.match(source, /function createCommentNode/);
    assert.match(source, /body\.textContent = comment\.content/);
    assert.match(source, /name\.textContent = comment\.full_name/);
    assert.doesNotMatch(source, /\$\{c\.content\}|\$\{r\.content\}|innerHTML = .*authorName/);
});

test('database uses TLS for remote databases but permits explicit local audit PostgreSQL', () => {
    const source = fs.readFileSync('src/core/database.js', 'utf8');
    assert.match(source, /function shouldUseSsl/);
    assert.match(source, /'127\.0\.0\.1'/);
    assert.match(source, /ssl: shouldUseSsl\(connectionString\)/);
    assert.match(source, /DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'/);

    for (const migration of [
        'scripts/apply_operational_schema.js',
        'scripts/apply_festival_registration_schema.js',
        'scripts/reconcile_legacy_commerce.js'
    ]) {
        const migrationSource = fs.readFileSync(migration, 'utf8');
        assert.match(migrationSource, /DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false'/, migration);
        assert.doesNotMatch(migrationSource, /rejectUnauthorized:\s*false/, migration);
    }
});

test('operational migration refuses incompatible legacy look-alike tables before recording success', () => {
    const migration = fs.readFileSync('scripts/apply_operational_schema.js', 'utf8');
    assert.match(migration, /async function schemaGaps/);
    assert.match(migration, /Incompatible existing operational schema/);
    assert.match(migration, /Applied migration schema drift/);
    assert.match(migration, /Migration did not produce required schema/);
    assert.match(migration, /dryRun: true, existingSchema: 'compatible'/);
});

test('network proxy and chat input keep TLS verification and bound untrusted content', () => {
    const server = fs.readFileSync('src/server.js', 'utf8');
    const api = fs.readFileSync('src/controllers/ApiController.js', 'utf8');
    assert.doesNotMatch(server, /rejectUnauthorized:\s*false/);
    assert.match(api, /normalizedMessage\.length > 2000/);
    assert.match(api, /typeof message !== 'string'/);
});

test('server applies baseline browser hardening headers without pretending legacy CDN pages have a CSP', () => {
    const server = fs.readFileSync('src/server.js', 'utf8');
    assert.match(server, /app\.disable\('x-powered-by'\)/);
    assert.match(server, /X-Content-Type-Options', 'nosniff'/);
    assert.match(server, /X-Frame-Options', 'SAMEORIGIN'/);
    assert.match(server, /Referrer-Policy', 'strict-origin-when-cross-origin'/);
    assert.match(server, /Cross-Origin-Opener-Policy', 'same-origin'/);
    assert.match(server, /Strict-Transport-Security/);
    assert.doesNotMatch(server, /Content-Security-Policy/);
});

test('machine translation is opt-in and does not load a third-party script on every public page', () => {
    const navbar = fs.readFileSync('src/views/partials/navbar.ejs', 'utf8');
    const adminLayout = fs.readFileSync('src/views/layouts/admin.ejs', 'utf8');
    const switcher = fs.readFileSync('public/js/i18n-switcher.js', 'utf8');
    assert.doesNotMatch(navbar, /translate\.google\.com\/translate_a\/element\.js/);
    assert.doesNotMatch(adminLayout, /translate\.google\.com\/translate_a\/element\.js/);
    assert.match(switcher, /function loadGoogleTranslateForEnglish/);
    assert.match(switcher, /if \(lang === 'en'\)[\s\S]*loadGoogleTranslateForEnglish\(\)/);
    assert.match(switcher, /function hasCookieDomain/);
    assert.doesNotMatch(navbar, /fonts\.googleapis\.com/);
    assert.doesNotMatch(adminLayout, /fonts\.googleapis\.com/);
});

test('inline script data and chat media use safe serializers rather than raw user strings', () => {
    const serializer = require('../src/utils/safeJson');
    const payload = serializer.safeJsonForScript({ name: '</script><img src=x onerror=alert(1)>' });
    assert.doesNotMatch(payload, /<\/?script|<img/i);
    assert.deepEqual(JSON.parse(payload), { name: '</script><img src=x onerror=alert(1)>' });

    for (const file of [
        'src/views/chat/index.ejs',
        'src/views/manager/chat.ejs',
        'src/views/admin/chat.ejs',
        'src/views/layouts/main.ejs'
    ]) {
        const source = fs.readFileSync(file, 'utf8');
        assert.match(source, /safe.*ChatMediaUrl/i, file);
        assert.doesNotMatch(source, /src="\$\{url\}"/, file);
    }

    const explore = fs.readFileSync('src/views/explore/show.ejs', 'utf8');
    assert.match(explore, /safeJsonForScript\(fixImg\(settings\.brand_logo/);
    assert.match(explore, /toast\.append\(icon, document\.createTextNode/);
    assert.doesNotMatch(explore, /toast\.innerHTML\s*=/);

    for (const file of ['src/views/admin/chat.ejs', 'src/views/manager/chat.ejs']) {
        const source = fs.readFileSync(file, 'utf8');
        assert.match(source, /function renderSafeVisitorAvatar/);
        assert.match(source, /container\.replaceChildren\(\)/);
        assert.doesNotMatch(source, /avatarEl\.innerHTML\s*=/);
        assert.doesNotMatch(source, /headerStatus\.innerHTML\s*=/);
    }
});

test('legacy booking awards are not granted on booking creation or cancelled booking', () => {
    const source = fs.readFileSync('src/controllers/ShopController.js', 'utf8');
    assert.doesNotMatch(source, /UPDATE users SET total_points = COALESCE\(total_points, 0\) \+ 50/);
    assert.doesNotMatch(source, /total_points = GREATEST\(0, COALESCE\(total_points, 0\) - 50\)/);
});

test('state-changing attendance, festival and commerce routes require an authenticated account', () => {
    const source = fs.readFileSync('src/routes/index.js', 'utf8');
    assert.match(source, /router\.post\('\/api\/checkin', ensureAuthenticated,/);
    assert.match(source, /router\.post\('\/api\/festival\/book', ensureAuthenticated,/);
    assert.match(source, /router\.post\('\/api\/products\/orders', ensureAuthenticated,/);
    assert.match(source, /router\.post\('\/api\/workshop-sessions\/bookings', ensureAuthenticated,/);
});

test('check-in binds the cookie session to the authenticated account and upload middleware rejects generic binary MIME', () => {
    const api = fs.readFileSync('src/controllers/ApiController.js', 'utf8');
    const upload = fs.readFileSync('src/middleware/upload.js', 'utf8');
    assert.match(api, /String\(session\.user_id \|\| ''\) !== String\(userId\)/);
    assert.doesNotMatch(api, /body\.sessionUuid \|\| req\.cookies/);
    assert.match(upload, /const allowedMimeTypes = new Set/);
    assert.doesNotMatch(upload, /application\/octet-stream/);
});

test('Workshop has its own public routes and session-reservation service instead of redirecting to Shop', () => {
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    const service = fs.readFileSync('src/services/WorkshopBookingService.js', 'utf8');
    assert.match(routes, /router\.get\('\/workshops', WorkshopController\.index\)/);
    assert.doesNotMatch(routes, /router\.get\('\/workshops', \(req, res\) => res\.redirect/);
    assert.match(service, /FOR UPDATE/);
    assert.match(service, /reserved_seats = reserved_seats \+ \$1/);
});

test('draft festivals are absent from public listing and unauthenticated festival booking is blocked at routing', () => {
    const model = fs.readFileSync('src/models/Festival.js', 'utf8');
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    assert.match(model, /COALESCE\(status, 'upcoming'\) <> 'draft'/);
    assert.match(routes, /router\.post\('\/api\/festival\/book', ensureAuthenticated,/);
});

test('festival registration UI uses stored values as DOM data rather than interpolated JavaScript arguments', () => {
    const source = fs.readFileSync('src/views/festivals/index.ejs', 'utf8');
    assert.match(source, /data-festival-id="<%= fest\.id %>"/);
    assert.match(source, /data-festival-name="<%= fest\.name %>"/);
    assert.doesNotMatch(source, /showBookingModal\(<%= fest\.id %>,\s*'<%= fest\.name %>'\)/);
});

test('festival ticket operations have protected customer and admin routes with an admin operations screen', () => {
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    const adminView = fs.readFileSync('src/views/admin/festival_tickets.ejs', 'utf8');
    assert.match(routes, /router\.post\('\/api\/festival\/tickets\/:id\/cancel', ensureAuthenticated,/);
    assert.match(routes, /router\.post\('\/api\/admin\/festival-tickets\/:id\/use', ensureAdmin,/);
    assert.match(routes, /router\.get\('\/admin\/festival-tickets', ensureAdmin,/);
    assert.match(adminView, /Xác nhận dùng/);
    assert.match(adminView, /Idempotency-Key/);
});

test('Shop remains a direct-contact catalogue and cannot create online product orders', () => {
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    const view = fs.readFileSync('src/views/shop/show.ejs', 'utf8');
    assert.match(routes, /router\.get\('\/shops', ShopController\.index\)/);
    assert.match(routes, /router\.get\('\/shops\/:id', ShopController\.show\)/);
    assert.match(routes, /router\.post\('\/api\/products\/orders', ensureAuthenticated, CommerceController\.shopOrdersRetired\)/);
    assert.match(view, /Liên hệ Zalo/);
    assert.doesNotMatch(view, /\/api\/products\/orders/);
});

test('the retired Shop-order URL returns staff to Shop management and is absent from navigation', () => {
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    const layout = fs.readFileSync('src/views/layouts/admin.ejs', 'utf8');
    assert.match(routes, /router\.get\('\/admin\/product-orders', ensureAdmin, \(req, res\) => res\.redirect\('\/admin\/shops'\)\)/);
    assert.doesNotMatch(layout, /Đơn hàng Shop/);
});

test('staff can preview public Shop, Workshop and festival pages without losing their admin session', () => {
    const server = fs.readFileSync('src/server.js', 'utf8');
    assert.match(server, /const isPublicPreview = path === '\/shops'/);
    assert.match(server, /path === '\/workshops'/);
    assert.match(server, /path === '\/festivals'/);
});

test('Shop and Workshop search, manager actions and festival cards retain the agreed responsive UI', () => {
    const shop = fs.readFileSync('src/views/shop/index.ejs', 'utf8');
    const workshop = fs.readFileSync('src/views/workshops/index.ejs', 'utf8');
    const manager = fs.readFileSync('src/views/manager/workshops.ejs', 'utf8');
    const tickets = fs.readFileSync('src/views/admin/festival_tickets.ejs', 'utf8');
    assert.match(shop, />\s*Tìm kiếm\s*</);
    assert.match(workshop, /Tìm kiếm/);
    assert.match(workshop, /workshop-search-button/);
    assert.doesNotMatch(workshop, /Trải nghiệm tại Bình Lợi|Mỗi ca có thời gian|Hãy thử lại sau/);
    assert.match(manager, /class="workshop-actions"/);
    assert.match(manager, /flex-wrap: nowrap/);
    assert.match(tickets, /col-12 col-md-6 col-xl-4/);
    assert.match(tickets, /href="\/festivals" target="_blank"/);
});

test('admin access and login redirects derive authority from role data, not an email substring', () => {
    const auth = fs.readFileSync('src/middleware/auth.js', 'utf8');
    const controller = fs.readFileSync('src/controllers/AuthController.js', 'utf8');
    assert.doesNotMatch(auth, /email\.includes\('binhloi'\)/);
    assert.doesNotMatch(controller, /userEmail\.includes\('binhloi'\)/);
    assert.match(auth, /Number\(user\.role_id\) === ROLES\.ADMIN/);
    assert.match(controller, /Number\(user\.role_id\) === 1/);
});

test('sensitive chat, moderation and upload writes are protected at routing and managers stay in their destination', () => {
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    const api = fs.readFileSync('src/controllers/ApiController.js', 'utf8');
    assert.match(routes, /router\.post\('\/api\/chat\/recall-message', ensureAuthenticated,/);
    assert.match(routes, /router\.post\('\/api\/reviews\/delete-comment', ensureAuthenticated,/);
    assert.match(routes, /router\.post\('\/api\/upload', ensureAuthenticated,/);
    assert.match(routes, /router\.post\('\/api\/chat\/upload', ensureAuthenticated,/);
    assert.match(routes, /router\.post\('\/api\/reply-message', ensureManager,/);
    assert.match(api, /Không thể phản hồi ngoài địa điểm được phân công/);
    assert.match(api, /String\(msg\.destination_id\) === String\(user\.managed_destination_id\)/);
});

test('session UUIDs are bound to the HttpOnly cookie rather than treated as URL credentials', () => {
    const api = fs.readFileSync('src/controllers/ApiController.js', 'utf8');
    assert.match(api, /const cookieUuid = req\.cookies\?\.session_uuid/);
    assert.match(api, /String\(uuid\) !== String\(cookieUuid\)/);
    assert.match(api, /Phiên không thuộc trình duyệt hiện tại/);
    assert.doesNotMatch(api, /let currentUuid = req\.cookies\?\.session_uuid \|\| uuid/);
});

test('journey suggestions do not resurrect Sống Chậm or claim route optimization without route computation', () => {
    const journey = fs.readFileSync('src/controllers/JourneyController.js', 'utf8');
    assert.match(journey, /criteria_required/);
    assert.doesNotMatch(journey, /userMoodLabel \|\| '🌿 Sống Chậm'/);
    assert.doesNotMatch(journey, /tối ưu quãng đường ngắn nhất/);
    assert.doesNotMatch(journey, /parseFloat\(t\.km\) \|\| 5\.0/);
});
