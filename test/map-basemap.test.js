const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const ejs = require('ejs');

test('map renders a keyed CARTO layer with required attribution', () => {
    const view = fs.readFileSync('src/views/map/index.ejs', 'utf8');
    const html = ejs.render(view, {
        allDests: [],
        journey: null,
        cartoBasemapApiKey: 'test_key_123',
        fixImg: () => '/images/no-image.svg'
    });

    assert.match(html, /const cartoBasemapApiKey = "test_key_123";/);
    assert.match(html, /\?key=\$\{encodeURIComponent\(cartoBasemapApiKey\)\}/);
    assert.match(html, /attributionControl: true/);
    assert.match(html, /OpenStreetMap contributors/);
    assert.match(html, /carto\.com\/attributions/);
});
