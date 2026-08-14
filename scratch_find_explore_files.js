const fs = require('fs');
const path = require('path');

const exploreDir = path.join(__dirname, 'src', 'views', 'explore');
fs.readdirSync(exploreDir).forEach(f => console.log(f));
