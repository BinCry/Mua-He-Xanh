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
            const lines = content.split('\n');
            lines.forEach((line, i) => {
                if (/title/i.test(line) && /workshop/i.test(line)) {
                    console.log(`${full}:${i+1}: ${line.trim()}`);
                }
            });
        }
    }
}

search(path.join(__dirname, '..', 'src'));
