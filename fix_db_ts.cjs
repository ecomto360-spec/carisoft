const fs = require('fs');
let c = fs.readFileSync('src/db/db.ts', 'utf8');

// Remove the injected hook
c = c.replace(/const \{ user \} = useAuthStore\(\);\r?\n/g, '');
c = c.replace(/const currentCompanyId = user\?\.companyId \|\| '';\r?\n/g, '');

fs.writeFileSync('src/db/db.ts', c);
