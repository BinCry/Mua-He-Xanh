const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const viewsDir = path.join(__dirname, '../src/views');

function getFiles(dir, files = []) {
    const fileList = fs.readdirSync(dir);
    for (const file of fileList) {
        const name = path.join(dir, file);
        if (fs.statSync(name).isDirectory()) {
            getFiles(name, files);
        } else if (name.endsWith('.ejs')) {
            files.push(name);
        }
    }
    return files;
}

const ejsFiles = getFiles(viewsDir);
let errors = 0;

console.log(`Found ${ejsFiles.length} EJS files. Compiling...`);

for (const file of ejsFiles) {
    const relativePath = path.relative(viewsDir, file);
    try {
        const content = fs.readFileSync(file, 'utf8');
        // Try compiling the template
        ejs.compile(content, { filename: file });
        console.log(`✅ ${relativePath}: Compiled successfully`);
    } catch (err) {
        console.error(`❌ ${relativePath}: COMPILATION ERROR!`);
        console.error(err.message);
        console.error('----------------------------------------');
        errors++;
    }
}

console.log(`\nCompilation test completed. Errors found: ${errors}`);
process.exit(errors > 0 ? 1 : 0);
