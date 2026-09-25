const fs = require('fs');
const path = 'src/components/TrialBanner.tsx';
let content = fs.readFileSync(path, 'utf8');

// The `daysLeft <= 0` condition doesn't prevent TrialLockScreen if `isSuperAdmin` is true but `daysLeft === 0`.
// Wait, the early return is `if (hasLicense || daysLeft === null || isSuperAdmin) return null;`
// So if `isSuperAdmin` is true, it returns `null` and DOES NOT execute `if (daysLeft <= 0)`.
// Therefore, the TrialBanner shouldn't be showing AT ALL if `isSuperAdmin` is true.

// Let's make the SuperAdmin condition more robust, similar to SettingsModule:
// user?.role === 'superadmin' || user?.email?.toLowerCase() === 'nabsterzero@gmail.com' || user?.username?.toLowerCase() === 'nabsterzero'

content = content.replace(
    "const isSuperAdmin = user?.role === 'superadmin' || user?.email?.toLowerCase() === 'nabsterzero@gmail.com';",
    "const isSuperAdmin = Boolean(user?.role === 'superadmin' || user?.email?.toLowerCase() === 'nabsterzero@gmail.com' || user?.username?.toLowerCase() === 'nabsterzero');"
);

fs.writeFileSync(path, content);
console.log("Updated TrialBanner.tsx super admin condition");
