const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('server startup does not apply legacy schema mutations unless explicitly opted in outside production', () => {
    const source = fs.readFileSync('src/server.js', 'utf8');
    assert.match(source, /const allowLegacySchemaAutopatch = process\.env\.NODE_ENV !== 'production'/);
    assert.match(source, /process\.env\.ALLOW_LEGACY_SCHEMA_AUTOPATCH === 'true'/);
    assert.match(source, /if \(allowLegacySchemaAutopatch && !global\._dbPatched\)/);
});
