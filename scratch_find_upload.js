const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
    });
}

const srcDir = path.join(__dirname, 'src');

walkDir(srcDir, filePath => {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('multer') || content.includes('upload')) {
        console.log(`Match in: ${path.relative(__dirname, filePath)}`);
    }
});
