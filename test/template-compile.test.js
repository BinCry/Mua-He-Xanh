const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ejs = require('ejs');

function collectTemplates(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) return collectTemplates(fullPath);
        return entry.isFile() && entry.name.endsWith('.ejs') ? [fullPath] : [];
    });
}

test('every EJS view compiles before release', () => {
    const templates = collectTemplates(path.join(__dirname, '..', 'src', 'views'));
    assert.ok(templates.length > 0, 'expected EJS templates');
    for (const template of templates) {
        assert.doesNotThrow(
            () => ejs.compile(fs.readFileSync(template, 'utf8'), { filename: template }),
            path.relative(process.cwd(), template)
        );
    }
});

