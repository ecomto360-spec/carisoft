const fs = require('fs');
const path = 'src/store/authStore.ts';
let content = fs.readFileSync(path, 'utf8');

// The login logic does NOT check username for superadmin.
// Let's add username check for consistency.

content = content.replace(/newUser\.role === 'superadmin' \|\| newUser\.email === 'nabsterzero@gmail\.com'/g, "newUser.role === 'superadmin' || newUser.email === 'nabsterzero@gmail.com' || newUser.username === 'nabsterzero'");
content = content.replace(/safeUser\.role === 'superadmin' \|\| safeUser\.email === 'nabsterzero@gmail\.com'/g, "safeUser.role === 'superadmin' || safeUser.email === 'nabsterzero@gmail.com' || safeUser.username === 'nabsterzero'");
content = content.replace(/initialUser\?\.role === 'superadmin' \|\| initialUser\?\.email === 'nabsterzero@gmail\.com'/g, "initialUser?.role === 'superadmin' || initialUser?.email === 'nabsterzero@gmail.com' || initialUser?.username === 'nabsterzero'");

fs.writeFileSync(path, content);
console.log("Updated authStore.ts");
