const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('database configuration has no source fallback credential', () => {
    const database = fs.readFileSync('src/core/database.js', 'utf8');
    assert.match(database, /DATABASE_URL is required/);
    assert.doesNotMatch(database, /pooler\.supabase\.com/);
});

test('map requests a minimal destination projection instead of all columns', () => {
    const model = fs.readFileSync('src/models/Destination.js', 'utf8');
    const controller = fs.readFileSync('src/controllers/MapController.js', 'utf8');
    assert.match(model, /getMapData\(\)/);
    assert.match(model, /SELECT id, slug, name, type, short_desc, lat, lng, cover_image/);
    assert.match(controller, /Destination\.getMapData\(\)/);
    assert.doesNotMatch(controller, /Destination\.findAll\(\)/);
});

test('uploads and review creation never fall back to data:image storage', () => {
    const upload = fs.readFileSync('src/config/cloudinary.js', 'utf8');
    const review = fs.readFileSync('src/controllers/ReviewController.js', 'utf8');
    assert.doesNotMatch(upload, /data:image\/webp;base64/);
    assert.doesNotMatch(review, /data:\$\{mime\};base64/);
});

test('runtime image processing dependency is installed in production', () => {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    assert.equal(packageJson.dependencies.sharp, '^0.35.3');
    assert.equal(packageJson.devDependencies.sharp, undefined);
});

test('server separates liveness from readiness and denies public exports', () => {
    const server = fs.readFileSync('src/server.js', 'utf8');
    assert.match(server, /app\.get\('\/api\/ready'/);
    assert.match(server, /app\.use\('\/exports'/);
    assert.doesNotMatch(server, /db_url_prefix/);
});

test('public fallback images refer to an existing asset', () => {
    const login = fs.readFileSync('src/views/auth/login.ejs', 'utf8');
    const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');
    assert.match(login, /\/images\/Poster 1\.jpg/);
    assert.match(serviceWorker, /Poster(?:%20| )1\.jpg/);
    assert.ok(fs.existsSync('public/images/Poster 1.jpg'));
});

test('avatar and festival fallbacks use durable public assets', () => {
    const managerDashboard = fs.readFileSync('src/views/manager/dashboard.ejs', 'utf8');
    const managerWorkshops = fs.readFileSync('src/views/manager/workshops.ejs', 'utf8');
    const festivals = fs.readFileSync('src/views/festivals/index.ejs', 'utf8');
    const explore = fs.readFileSync('src/views/explore/show.ejs', 'utf8');

    assert.ok(fs.existsSync('public/images/default-avatar.svg'));
    assert.match(managerDashboard, /\/images\/default-avatar\.svg/);
    assert.match(managerWorkshops, /\/images\/default-avatar\.svg/);
    assert.doesNotMatch(managerDashboard, /\/images\/default-avatar\.png/);
    assert.match(festivals, /fixImg\(fest\.image, '\/uploads\/destinations\/vuon-mai\.webp'\)/);
    assert.doesNotMatch(festivals, /\/images\/hero-[123]\.png/);
    assert.match(explore, /fixImg\(dest\.cover_image, '\/images\/no-image\.svg'\)/);
});

test('all shop product mutations clear public shop caches', () => {
    const manager = fs.readFileSync('src/controllers/ManagerController.js', 'utf8');
    const admin = fs.readFileSync('src/controllers/AdminController.js', 'utf8');

    for (const controller of [manager, admin]) {
        assert.match(controller, /function invalidateShopCache\(\)\s*\{\s*cache\.del\('shops:\*'\);\s*\}/);
        assert.equal((controller.match(/invalidateShopCache\(\);/g) || []).length, 3);
    }
});

test('the root administrator cannot have their access controls changed', () => {
    const controller = fs.readFileSync('src/controllers/AdminController.js', 'utf8');
    const usersView = fs.readFileSync('src/views/admin/users.ejs', 'utf8');

    assert.match(controller, /ROOT_ADMIN_EMAIL = 'binhloi\.travel@gmail\.com'/);
    assert.match(controller, /SELECT id, full_name, phone, email, role, is_active, managed_destination_id FROM users WHERE id = \$1/);
    assert.match(controller, /isRootAdmin && \(nextRole !== 'admin' \|\| nextIsActive !== 1/);
    assert.match(usersView, /is_root_admin: isRootAdmin/);
    assert.match(usersView, /setRootAdminProtection\(user\.is_root_admin === true\)/);
    assert.match(usersView, /u_role'\)\.disabled = isRootAdmin/);
    assert.match(usersView, /u_is_active'\)\.disabled = isRootAdmin/);
});

test('all account identities and every user password are immutable from user management', () => {
    const controller = fs.readFileSync('src/controllers/AdminController.js', 'utf8');
    const usersView = fs.readFileSync('src/views/admin/users.ejs', 'utf8');

    assert.match(controller, /hasField\('full_name'\) && hasChanged\(targetUser\.full_name, full_name\)/);
    assert.match(controller, /hasField\('phone'\) && hasChanged\(targetUser\.phone, phone\)/);
    assert.match(controller, /hasField\('email'\) && hasChanged\(targetUser\.email, email/);
    assert.match(controller, /Không thể đổi mật khẩu người dùng từ trang quản trị/);
    assert.match(controller, /Họ tên, số điện thoại và email chỉ được xem tại trang quản lý người dùng/);
    assert.doesNotMatch(controller, /sets\.push\(`full_name =/);
    assert.doesNotMatch(controller, /sets\.push\(`phone =/);
    assert.doesNotMatch(controller, /sets\.push\(`email =/);
    assert.match(usersView, /const isAdminIdentityLocked = editingUser/);
    assert.match(usersView, /field\.disabled = isAdminIdentityLocked/);
    assert.match(usersView, /passwordGroup'\)\.style\.display = 'none'/);
    assert.match(usersView, /if \(!editingUser\) \{/);
    assert.match(usersView, /data\.full_name = document\.getElementById\('u_full_name'\)\.value/);
});

test('staff accounts have a minimal profile separate from tourist profiles', () => {
    const routes = fs.readFileSync('src/routes/index.js', 'utf8');
    const profileController = fs.readFileSync('src/controllers/ProfileController.js', 'utf8');
    const adminLayout = fs.readFileSync('src/views/layouts/admin.ejs', 'utf8');
    const staffProfile = fs.readFileSync('src/views/profile/staff.ejs', 'utf8');

    assert.match(routes, /router\.get\('\/admin\/profile', ensureAdmin, ProfileController\.staffProfile\)/);
    assert.match(routes, /router\.get\('\/manager\/profile', ensureManager, ProfileController\.staffProfile\)/);
    assert.match(routes, /router\.post\('\/api\/staff\/profile', ensureAuthenticated/);
    assert.match(profileController, /staffProfile: async/);
    assert.match(profileController, /updateStaffProfile: async/);
    assert.match(profileController, /SELECT id, full_name, phone, avatar, role FROM users WHERE id = \$1/);
    assert.match(profileController, /SELECT id, avatar, role FROM users WHERE id = \$1/);
    assert.match(profileController, /\['admin', 'manager'\]\.includes\(staffUser\.role\)/);
    assert.match(adminLayout, /href="\/admin\/profile"/);
    assert.match(adminLayout, /href="\/manager\/profile"/);
    assert.match(staffProfile, /staffUser\.full_name/);
    assert.match(staffProfile, /staffUser\.phone/);
    assert.doesNotMatch(staffProfile, /staffUser\.email/);
    assert.match(staffProfile, /name="avatar" type="file"/);
    assert.match(staffProfile, /name="full_name"/);
    assert.match(staffProfile, /name="phone"/);
    assert.match(staffProfile, /new FormData\(form\)/);
});

async function updateUserWithMockedDatabase(existingUser, body) {
    const db = require('../src/core/database');
    const originalQuery = db.query;
    const calls = [];
    const response = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
            return this;
        }
    };

    const controllerPath = require.resolve('../src/controllers/AdminController');
    let AdminController;
    if (require.cache[controllerPath]) {
        AdminController = require('../src/controllers/AdminController');
    } else {
        db.query = async () => [[], []];
        try {
            AdminController = require('../src/controllers/AdminController');
        } finally {
            db.query = originalQuery;
        }
    }

    db.query = async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('SELECT id, full_name, phone, email, role, is_active, managed_destination_id FROM users WHERE id = $1')) {
            return [[existingUser]];
        }
        if (sql.startsWith('UPDATE users SET')) return [[], []];
        throw new Error(`Unexpected query in role-transition test: ${sql}`);
    };

    try {
        await AdminController.updateUser({ body }, response);
        return { calls, response };
    } finally {
        db.query = originalQuery;
    }
}

test('role transitions retain only the destination assignment appropriate to the resulting role', async () => {
    const baseUser = (role, managedDestinationId) => ({
        id: 'user-1',
        full_name: 'Test User',
        phone: '0900000000',
        email: 'test.user@example.com',
        role,
        is_active: 1,
        managed_destination_id: managedDestinationId
    });
    const transitions = [
        { from: 'user', fromDestination: null, to: 'manager', toDestination: 'destination-a' },
        { from: 'manager', fromDestination: 'destination-a', to: 'user', toDestination: null },
        { from: 'manager', fromDestination: 'destination-a', to: 'admin', toDestination: null },
        { from: 'admin', fromDestination: null, to: 'manager', toDestination: 'destination-b' },
        { from: 'user', fromDestination: null, to: 'admin', toDestination: null },
        { from: 'admin', fromDestination: null, to: 'user', toDestination: null }
    ];

    for (const transition of transitions) {
        const existingUser = baseUser(transition.from, transition.fromDestination);
        const body = {
            id: existingUser.id,
            full_name: existingUser.full_name,
            phone: existingUser.phone,
            email: existingUser.email,
            role: transition.to,
            is_active: 1,
            managed_destination_id: transition.toDestination
        };
        const { calls, response } = await updateUserWithMockedDatabase(existingUser, body);
        const update = calls.find(({ sql }) => sql.startsWith('UPDATE users SET'));

        assert.equal(response.statusCode, 200, `${transition.from} -> ${transition.to} should succeed`);
        assert.equal(response.payload.success, true, `${transition.from} -> ${transition.to} should return success`);
        assert.ok(update, `${transition.from} -> ${transition.to} should write an update`);
        assert.deepEqual(update.params.slice(0, 3), [transition.to, 1, transition.toDestination]);
        assert.equal(update.params.at(-1), existingUser.id);
    }
});

test('partial approval preserves an existing manager role and destination assignment', async () => {
    const existingUser = {
        id: 'manager-1',
        full_name: 'Manager User',
        phone: '0911111111',
        email: 'manager.user@example.com',
        role: 'manager',
        is_active: 0,
        managed_destination_id: 'destination-a'
    };
    const { calls, response } = await updateUserWithMockedDatabase(existingUser, {
        id: existingUser.id,
        is_active: 1
    });
    const update = calls.find(({ sql }) => sql.startsWith('UPDATE users SET'));

    assert.equal(response.payload.success, true);
    assert.deepEqual(update.params.slice(0, 3), ['manager', 1, 'destination-a']);
});

test('user management rejects contact-information changes for every existing role', async () => {
    for (const role of ['user', 'manager', 'admin']) {
        const existingUser = {
            id: `${role}-1`,
            full_name: 'Original Name',
            phone: '0900000000',
            email: `${role}@example.com`,
            role,
            is_active: 1,
            managed_destination_id: role === 'manager' ? 'destination-a' : null
        };
        const { calls, response } = await updateUserWithMockedDatabase(existingUser, {
            id: existingUser.id,
            full_name: 'Tampered Name',
            role,
            is_active: 1
        });

        assert.equal(response.statusCode, 403, `${role} identity update must be denied`);
        assert.equal(response.payload.success, false);
        assert.equal(calls.some(({ sql }) => sql.startsWith('UPDATE users SET')), false);
    }
});

async function updateStaffProfileWithMockedDatabase(existingUser, request) {
    const db = require('../src/core/database');
    const originalQuery = db.query;
    const calls = [];
    const response = {
        statusCode: 200,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
            return this;
        }
    };
    const ProfileController = require('../src/controllers/ProfileController');

    db.query = async (sql, params) => {
        calls.push({ sql, params });
        if (sql.includes('SELECT id, avatar, role FROM users WHERE id = $1')) return [[existingUser]];
        if (sql.includes('UPDATE users')) {
            return [[{
                id: existingUser.id,
                full_name: params[0],
                phone: params[1],
                avatar: params[2],
                role: existingUser.role
            }]];
        }
        throw new Error(`Unexpected query in staff-profile test: ${sql}`);
    };

    try {
        await ProfileController.updateStaffProfile(request, response);
        return { calls, response };
    } finally {
        db.query = originalQuery;
    }
}

test('staff profiles update only the signed-in admin or manager and allow a blank phone number', async () => {
    for (const role of ['admin', 'manager']) {
        const existingUser = { id: `${role}-self`, avatar: '/old-avatar.webp', role };
        const session = { user: { id: existingUser.id, full_name: 'Before', phone: '0900000000', avatar: existingUser.avatar } };
        const { calls, response } = await updateStaffProfileWithMockedDatabase(existingUser, {
            body: { id: 'someone-else', full_name: '  Tên mới  ', phone: '' },
            session
        });
        const update = calls.find(({ sql }) => sql.includes('UPDATE users'));

        assert.equal(response.statusCode, 200, `${role} can edit their own profile`);
        assert.equal(response.payload.success, true);
        assert.deepEqual(update.params, ['Tên mới', '', '/old-avatar.webp', existingUser.id]);
        assert.equal(session.user.full_name, 'Tên mới');
        assert.equal(session.user.phone, '');
    }
});

test('staff profile stores an uploaded avatar instead of accepting a browser-provided URL', async () => {
    const cloudinary = require('../src/config/cloudinary');
    const originalUpload = cloudinary.uploadToCloudinary;
    const existingUser = { id: 'admin-self', avatar: '/old-avatar.webp', role: 'admin' };
    const session = { user: { id: existingUser.id } };
    let uploadArgs;
    cloudinary.uploadToCloudinary = async (...args) => {
        uploadArgs = args;
        return { url: '/uploads/media/new-avatar.webp' };
    };

    try {
        const { calls, response } = await updateStaffProfileWithMockedDatabase(existingUser, {
            body: { full_name: 'Admin mới', phone: '' },
            file: { path: '/temporary/avatar.png', mimetype: 'image/png' },
            session
        });
        const update = calls.find(({ sql }) => sql.includes('UPDATE users'));

        assert.equal(response.payload.success, true);
        assert.deepEqual(uploadArgs, ['/temporary/avatar.png', 'binh-loi/avatars']);
        assert.equal(update.params[2], '/uploads/media/new-avatar.webp');
        assert.equal(session.user.avatar, '/uploads/media/new-avatar.webp');
    } finally {
        cloudinary.uploadToCloudinary = originalUpload;
    }
});

test('staff profile rejects a blank name and a non-staff account', async () => {
    const blank = await updateStaffProfileWithMockedDatabase(
        { id: 'manager-1', avatar: null, role: 'manager' },
        { body: { full_name: '   ', phone: '' }, session: { user: { id: 'manager-1' } } }
    );
    assert.equal(blank.response.statusCode, 400);
    assert.equal(blank.calls.length, 0);

    const nonStaff = await updateStaffProfileWithMockedDatabase(
        { id: 'user-1', avatar: null, role: 'user' },
        { body: { full_name: 'Visitor', phone: '' }, session: { user: { id: 'user-1' } } }
    );
    assert.equal(nonStaff.response.statusCode, 403);
    assert.equal(nonStaff.calls.some(({ sql }) => sql.includes('UPDATE users')), false);
});
