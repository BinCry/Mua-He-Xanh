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
            if (content.includes('Workshop & Trải Nghiệm') || content.includes('Workshop &amp; Trải Nghiệm')) {
                console.log('FOUND IN:', full);
                const lines = content.split('\n');
                lines.forEach((line, i) => {
                    if (line.includes('Workshop & Trải Nghiệm') || line.includes('Workshop &amp; Trải Nghiệm')) {
                        console.log(`  Line ${i+1}: ${line.trim()}`);
                    }
                });
            }
        }
    }
}

search(path.join(__dirname, '..', 'src'));
