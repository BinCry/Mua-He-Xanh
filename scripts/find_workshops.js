const fs = require('fs');
const path = require('path');

const results = [];

function searchDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            searchDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.ejs')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            lines.forEach((line, idx) => {
                if (/workshop/i.test(line)) {
                    results.push({ file: fullPath, lineNum: idx + 1, text: line.trim() });
                }
            });
        }
    }
}

searchDir(path.join(__dirname, '..', 'src'));
console.log(`Found ${results.length} occurrences of 'workshop':`);
results.forEach(r => {
    console.log(`${r.file}:${r.lineNum}: ${r.text.substring(0, 100)}`);
});
