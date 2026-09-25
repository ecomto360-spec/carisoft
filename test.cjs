const fs = require('fs');
let s = fs.readFileSync('src/store/authStore.ts', 'utf8');
console.log(s.match(/isSuperAdmin:.*/)[0]);
