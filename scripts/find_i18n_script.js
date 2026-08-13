const fs = require('fs');
const path = require('path');

function search(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            search(full);
        } else if (f.endsWith('.js') || f.endsWith('.ejs')) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('i18n-switcher')) {
                console.log('FOUND IN:', full);
            }
        }
    }
}

search(path.join(__dirname, '..', 'src'));
