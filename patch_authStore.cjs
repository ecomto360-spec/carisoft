const fs = require('fs');
let c = fs.readFileSync('src/store/authStore.ts', 'utf8');
c = c.replace(/delete safeUser.password;\s*try {/, "delete safeUser.password;\n    if (safeUser.companyId) setDbTenantId(safeUser.companyId);\n    try {");
fs.writeFileSync('src/store/authStore.ts', c);
