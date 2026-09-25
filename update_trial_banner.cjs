const fs = require('fs');

const path = 'src/components/TrialBanner.tsx';
let content = fs.readFileSync(path, 'utf8');

// We need to inject useAuthStore to check if the user is superadmin
// Import it if not exists
if (!content.includes('useAuthStore')) {
    content = content.replace("import React", "import { useAuthStore } from '../store/authStore';\nimport React");
}

// In TrialBanner function, get the user and check if superadmin
content = content.replace("export function TrialBanner() {", "export function TrialBanner() {\n  const { user } = useAuthStore();\n  const isSuperAdmin = user?.role === 'superadmin' || user?.email?.toLowerCase() === 'nabsterzero@gmail.com';");

// Update the early return condition to also return null if user is superadmin
content = content.replace("if (hasLicense || daysLeft === null) return null;", "if (hasLicense || daysLeft === null || isSuperAdmin) return null;");

fs.writeFileSync(path, content);
console.log("Updated TrialBanner.tsx");
