const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/SuperAdminPanel.tsx', 'utf8');

content = content.replace(
  "const q = query(collection(firestore, 'customers'));",
  "const q = query(collection(firestore, 'companies'));"
);

content = content.replace(
  "const customerRef = doc(firestore, 'customers', customerId);",
  "const customerRef = doc(firestore, 'companies', customerId);"
);

content = content.replace(
  "const customerRef = doc(firestore, 'customers', customerId);",
  "const customerRef = doc(firestore, 'companies', customerId);"
);

fs.writeFileSync('src/pages/admin/SuperAdminPanel.tsx', content);
