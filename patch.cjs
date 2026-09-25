const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Header.tsx', 'utf8');

content = content.replace(
  "<span>{settings?.licensePlan || t.header.activeLicense} ({expiryDays} j)</span>",
  "<span>{settings?.licensePlan?.includes('Essai') ? 'Clé activée' : (settings?.licensePlan || 'Clé activée')} ({expiryDays} j)</span>"
);

fs.writeFileSync('src/components/layout/Header.tsx', content);
