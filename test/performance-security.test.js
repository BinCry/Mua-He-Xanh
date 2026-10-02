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
