const fs = require('fs');
let content = fs.readFileSync('src/pages/auth/SetupCompanyPage.tsx', 'utf8');

const oldBlock = `            setDoc(newCompanyRef, {
              id: companyId,
              name: companyName.trim().toUpperCase(),
              slug: finalSlug,
              ownerId: user.id,
              createdAt: serverTimestamp()
            }),`;

const newBlock = `            setDoc(newCompanyRef, {
              id: companyId,
              name: companyName.trim().toUpperCase(),
              slug: finalSlug,
              ownerId: user.id,
              ownerEmail: user.email || '',
              licenseKey: settings?.licenseKey || '',
              licensePlan: settings?.licensePlan || 'Essai Gratuit',
              licenseExpiry: settings?.licenseExpiry || '',
              licenseStatus: settings?.licenseStatus || 'active',
              createdAt: serverTimestamp()
            }),`;

if (content.includes("slug: finalSlug,")) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync('src/pages/auth/SetupCompanyPage.tsx', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find block to replace");
}
