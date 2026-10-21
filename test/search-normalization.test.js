const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSearchText, searchPattern, searchTokens, sqlNormalized, buildTokenSearchClause } = require('../src/utils/search');
const db = require('../src/core/database');
const cache = require('../src/core/cache');
const ShopController = require('../src/controllers/ShopController');
const WorkshopController = require('../src/controllers/WorkshopController');
const ExploreController = require('../src/controllers/ExploreController');
const ApiController = require('../src/controllers/ApiController');
const Destination = require('../src/models/Destination');

function response() {
    return {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        render(view, payload) { this.view = view; this.payload = payload; return payload; },
        send(payload) { this.payload = payload; return payload; }
    };
}

test('text search normalizes case, whitespace and Vietnamese diacritics', () => {
    assert.equal(normalizeSearchText('  LÀNG   mai VÀNG '), 'lang mai vang');
    assert.equal(normalizeSearchText('Địa điểm'), 'dia diem');
    assert.equal(searchPattern('Làng mai vàng'), '%lang mai vang%');
});

test('search helpers split words and escape LIKE metacharacters literally', () => {
    assert.deepEqual(searchTokens('  Workshop   Lang   Mai  '), ['workshop', 'lang', 'mai']);
    assert.equal(searchPattern('100%_sale'), '%100\\%\\_sale%');
});

test('database search expression is deterministic and has no request-controlled SQL identifier', () => {
    assert.match(sqlNormalized('name'), /^translate\(lower\(coalesce\(name, ''\)\), '/);
    assert.match(sqlNormalized('d.short_desc'), /translate\(lower\(coalesce\(d\.short_desc, ''\)\), '/);
});

test('Vietnamese translation tables preserve a one-to-one character mapping', () => {
    const source = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
    assert.equal(source.length, 67);
    const expression = sqlNormalized('name');
    const values = [...expression.matchAll(/'([^']*)'/g)].map(match => match[1]);
    assert.equal(values.at(-2).length, values.at(-1).length);
});

test('tokenized search accepts incomplete, reordered and mixed-case terms across approved columns', () => {
    const result = buildTokenSearchClause(['w.title', 'w.description', 'd.name'], '  MAI   lAnG  ', 4);
    assert.match(result.clause, /w\.title/);
    assert.match(result.clause, /w\.description/);
    assert.match(result.clause, /d\.name/);
    assert.match(result.clause, /LIKE \$4 ESCAPE/);
    assert.match(result.clause, /LIKE \$5 ESCAPE/);
    assert.match(result.clause, /\) AND \(/);
    assert.deepEqual(result.params, ['%mai%', '%lang%']);
    assert.equal(result.nextIndex, 6);
});

test('Explore, Shop and Workshop pass a typed Vietnamese query through to their catalogue search', async () => {
    const originalQuery = db.query;
    const originalPaginateActive = Destination.paginateActive;
    const captured = [];
    cache.flush();
    db.query = async (sql, params) => {
        captured.push({ sql, params });
        return [[]];
    };
    Destination.paginateActive = async (page, perPage, type, unused, search) => ({
        data: [], pagination: { page, perPage }, search
    });

    try {
        const shop = response();
        await ShopController.index({ query: { q: '  Làng   Mai ' } }, shop);
        assert.equal(shop.view, 'shop/index');
        assert.equal(shop.payload.searchQuery, 'Làng Mai');
        assert.deepEqual(captured[0].params, ['%lang%', '%mai%']);

        const workshop = response();
        await WorkshopController.index({ query: { q: '  Làng   Mai ' } }, workshop);
        assert.equal(workshop.view, 'workshops/index');
        assert.equal(workshop.payload.searchQuery, 'Làng Mai');
        assert.deepEqual(captured[1].params, ['%lang%', '%mai%']);

        const explore = response();
        await ExploreController.list({ query: { q: '  Làng   Mai ' } }, explore);
        assert.equal(explore.view, 'explore/list');
        assert.equal(explore.payload.searchQuery, 'Làng Mai');
        assert.equal(explore.payload.destinations.length, 0);
    } finally {
        db.query = originalQuery;
        Destination.paginateActive = originalPaginateActive;
        cache.flush();
    }
});

test('public destinations API forwards its normalized q to the existing search model', async () => {
    const originalPaginateActive = Destination.paginateActive;
    const calls = [];
    const res = { json(payload) { this.payload = payload; } };
    Destination.paginateActive = async (...args) => {
        calls.push(args);
        return { data: [], pagination: {} };
    };

    try {
        await ApiController.destinations({ query: { q: '  LANG   mai ', page: '1', limit: '5' } }, res);
        assert.equal(calls.length, 1);
        assert.deepEqual(calls[0], [1, 5, null, null, 'lang mai']);
        assert.deepEqual(res.payload, { data: [], pagination: {} });
    } finally {
        Destination.paginateActive = originalPaginateActive;
    }
});

test('public destination details API returns only allowlisted fields', async () => {
    const originalFindBySlug = Destination.findBySlug;
    const res = response();
    res.json = function json(payload) { this.payload = payload; return payload; };
    Destination.findBySlug = async slug => ({
        id: 'destination-1',
        slug,
        name: 'Lang Mai Vang',
        type: 'craft',
        description: 'Long description',
        short_desc: 'Short description',
        open_hours: '08:00-17:00',
        cost: 'Free',
        highlight: 'Apricot blossoms',
        best_time: 'Spring',
        lat: 10.7,
        lng: 106.6,
        cover_image: '/images/destination.jpg',
        story: 'Public story',
        is_active: 1,
        qr_secret: 'must-not-leak',
        internal_notes: 'must-not-leak'
    });

    try {
        await ApiController.destinationDetails({ params: { slug: 'lang-mai-vang' } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.payload, {
            data: {
                id: 'destination-1',
                slug: 'lang-mai-vang',
                name: 'Lang Mai Vang',
                type: 'craft',
                description: 'Long description',
                short_description: 'Short description',
                open_hours: '08:00-17:00',
                cost: 'Free',
                highlight: 'Apricot blossoms',
                best_time: 'Spring',
                latitude: 10.7,
                longitude: 106.6,
                cover_image: '/images/destination.jpg',
                story: 'Public story'
            }
        });
        assert.equal(JSON.stringify(res.payload).includes('qr_secret'), false);
        assert.equal(JSON.stringify(res.payload).includes('internal_notes'), false);
    } finally {
        Destination.findBySlug = originalFindBySlug;
    }
});

test('public destination details API returns 404 for a missing slug', async () => {
    const originalFindBySlug = Destination.findBySlug;
    const res = response();
    res.json = function json(payload) { this.payload = payload; return payload; };
    Destination.findBySlug = async () => null;

    try {
        await ApiController.destinationDetails({ params: { slug: 'missing' } }, res);
        assert.equal(res.statusCode, 404);
        assert.deepEqual(res.payload, { success: false, message: 'Destination not found' });
    } finally {
        Destination.findBySlug = originalFindBySlug;
    }
});

test('public destination details API rejects non-canonical and inactive matches', async () => {
    const originalFindBySlug = Destination.findBySlug;
    const cases = [
        {
            requested: ' canonical-slug ',
            found: { slug: 'canonical-slug', is_active: 1 }
        },
        {
            requested: 'qr-secret-value',
            found: { slug: 'canonical-slug', is_active: 1 }
        },
        {
            requested: 'canonical-slug',
            found: { slug: 'canonical-slug', is_active: 0 }
        }
    ];

    try {
        for (const testCase of cases) {
            const res = response();
            res.json = function json(payload) { this.payload = payload; return payload; };
            Destination.findBySlug = async () => ({
                id: 'destination-1',
                name: 'Destination',
                ...testCase.found
            });

            await ApiController.destinationDetails({ params: { slug: testCase.requested } }, res);
            assert.equal(res.statusCode, 404);
            assert.deepEqual(res.payload, { success: false, message: 'Destination not found' });
        }
    } finally {
        Destination.findBySlug = originalFindBySlug;
    }
});
