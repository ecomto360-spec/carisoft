const fs = require('fs');
const path = 'src/pages/settings/SettingsModule.tsx';
let content = fs.readFileSync(path, 'utf8');

// We need to determine hasLicense in SettingsModule as well.
// Wait, is there a hasLicense state? Let's check.
if (!content.includes('hasLicense')) {
  // Let's add it right after isSuperAdmin
  const hasLicenseLogic = `  const hasLicense = Boolean(localStorage.getItem('active_license_key'));\n`;
  content = content.replace("const isSuperAdmin =", hasLicenseLogic + "  const isSuperAdmin =");
}

// Modify the defaults in useEffect
content = content.replace(
    "setLicenseKey(settingsDb.licenseKey || 'CARI-2026-SAAS-PRO-8942-X1');",
    "setLicenseKey(hasLicense ? (settingsDb.licenseKey || 'CARI-2026-SAAS-PRO-8942-X1') : '');"
);
content = content.replace(
    "setLicensePlan(settingsDb.licensePlan || 'SaaS Entreprise (1 An)');",
    "setLicensePlan(hasLicense ? (settingsDb.licensePlan || 'SaaS Entreprise (1 An)') : 'Période d\\'essai (Non Activée)');"
);
content = content.replace(
    "setLicenseExpiry(settingsDb.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());",
    "setLicenseExpiry(hasLicense ? (settingsDb.licenseExpiry || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()) : '');"
);

// Modify the badge in the UI
content = content.replace(
    `                  <h3 className="font-bold text-lg text-white">Licence SaaS 1 An</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                    ACTIVE
                  </span>`,
    `                  <h3 className="font-bold text-lg text-white">{hasLicense ? "Licence SaaS 1 An" : "Licence SaaS"}</h3>
                  <span className={\`px-2 py-0.5 rounded-full text-xs font-bold \${hasLicense ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}\`}>
                    {hasLicense ? "ACTIVE" : "NON ACTIVÉE"}
                  </span>`
);

content = content.replace(
    `              <Clock className="h-4 w-4 text-blue-400" />
              Valable jusqu'au : <strong className="text-white">{licenseExpiry ? new Date(licenseExpiry).toLocaleDateString() : '---'}</strong>`,
    `              <Clock className="h-4 w-4 text-blue-400" />
              Valable jusqu'au : <strong className="text-white">{hasLicense && licenseExpiry ? new Date(licenseExpiry).toLocaleDateString() : '---'}</strong>`
);

fs.writeFileSync(path, content);
console.log("Updated SettingsModule for trial state");
