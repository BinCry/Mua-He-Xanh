const fs = require('fs');
const lines = fs.readFileSync('./src/views/home/index.ejs', 'utf8').split('\n');
lines.forEach((line, idx) => {
    if (line.includes('DESTINATIONS') || line.includes('featured') || line.includes('dest-card') || line.includes('bento')) {
        console.log(`L${idx+1}: ${line.trim()}`);
    }
});
