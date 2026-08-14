const fs = require('fs');
const path = require('path');

function searchDir(dir) {
    fs.readdirSync(dir).forEach(f => {
        const full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) {
            searchDir(full);
        } else if (f.endsWith('.ejs') || f.endsWith('.js') || f.endsWith('.html')) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('Được tin chọn bởi khách hàng toàn quốc')) {
                console.log("MATCH in:", full);
                const lines = content.split('\n');
                lines.forEach((l, idx) => {
                    if (l.includes('Được tin chọn bởi khách hàng toàn quốc')) {
                        console.log(`Line ${idx + 1}: ${l.trim()}`);
                    }
                });
            }
        }
    });
}

searchDir(path.join(__dirname, 'src'));
