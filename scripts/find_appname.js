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
            if (content.includes('appName')) {
                console.log('FOUND appName IN:', full);
                const lines = content.split('\n');
                lines.forEach((line, i) => {
                    if (line.includes('appName')) {
                        console.log(`  Line ${i+1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

search(path.join(__dirname, '..', 'src'));
