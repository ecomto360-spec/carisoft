const fs = require('fs');
let content = fs.readFileSync('src/pages/settings/SettingsModule.tsx', 'utf8');

if (!content.includes('import { SuperAdminPanel }')) {
    content = content.replace("import { LanguageSelector } from '../../components/common/LanguageSelector';", "import { LanguageSelector } from '../../components/common/LanguageSelector';\nimport { SuperAdminPanel } from '../admin/SuperAdminPanel';");
}

const oldBlock = `      {/* EXCLUSIVE SUPER ADMIN LICENSE GENERATOR */}
      {isSuperAdmin ? (`;

const newBlock = `      {/* SUPER ADMIN CUSTOMER LIST PANEL */}
      {isSuperAdmin && (
        <div className="bg-slate-900 rounded-2xl overflow-hidden mt-8 shadow-xl">
          <SuperAdminPanel />
        </div>
      )}

      {/* EXCLUSIVE SUPER ADMIN LICENSE GENERATOR */}
      {isSuperAdmin ? (`;

if (content.includes("{/* EXCLUSIVE SUPER ADMIN LICENSE GENERATOR */}")) {
    content = content.replace(oldBlock, newBlock);
    fs.writeFileSync('src/pages/settings/SettingsModule.tsx', content);
    console.log("Patched successfully");
} else {
    console.log("Could not find block to replace");
}
