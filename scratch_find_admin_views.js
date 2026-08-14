const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, 'src', 'views', 'admin');
fs.readdirSync(adminDir).forEach(f => console.log(f));
