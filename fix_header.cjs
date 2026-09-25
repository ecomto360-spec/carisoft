const fs = require('fs');

const path = 'src/components/layout/Header.tsx';
let content = fs.readFileSync(path, 'utf8');

// Inside Header.tsx, we want to hide the PRO/license pill for the super admin as well.
// Wait, the super admin is the one checking licenses. The user asked:
// "le super admin ne dois pas avoir le message de la bande acheter une licence ! ni une periode determiné !"

// In the Header.tsx, let's see where `(expiryDays} j)` is rendered.
// Replace `<span>{settings?.licensePlan || t.header.activeLicense} ({expiryDays} j)</span>`
// With `{isSuperAdmin ? <span>Super Administrateur SaaS</span> : <span>{settings?.licensePlan || t.header.activeLicense} ({expiryDays} j)</span>}`

// Actually, maybe the super admin shouldn't see that entire block, or should see a special badge.
content = content.replace(
    `              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />\n              <span>{settings?.licensePlan || t.header.activeLicense} ({expiryDays} j)</span>\n              <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">\n                PRO\n              </span>`,
    `              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />\n              <span>{isSuperAdmin ? "Licence SaaS Mondiale" : (settings?.licensePlan || t.header.activeLicense + " (" + expiryDays + " j)")}</span>\n              <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">\n                {isSuperAdmin ? "SUPER ADMIN" : "PRO"}\n              </span>`
);

fs.writeFileSync(path, content);
console.log("Updated Header.tsx");
