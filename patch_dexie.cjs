const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles) {
  const files = fs.readdirSync(dirPath);
  arrayOfFiles = arrayOfFiles || [];
  files.forEach(function(file) {
    if (fs.statSync(dirPath + "/" + file).isDirectory()) {
      arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
    } else {
      arrayOfFiles.push(path.join(__dirname, dirPath, "/", file));
    }
  });
  return arrayOfFiles.filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
}

const files = getAllFiles('src');
let filesChanged = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('db.') && content.includes('useLiveQuery')) {
    
    // Check if we already import useAuthStore, if not add it
    if (!content.includes('useAuthStore')) {
      // Find the last import
      const importRegex = /import .* from '.*';/g;
      let lastMatch = null;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastMatch = match;
      }
      
      let importPath = '../store/authStore';
      let depth = file.split('/').length - 2; // src/pages/Dashboard.tsx -> 2 -> depth 1
      if (depth === 2) importPath = '../../store/authStore';
      if (depth === 3) importPath = '../../../store/authStore';
      
      if (lastMatch) {
         content = content.slice(0, lastMatch.index + lastMatch[0].length) + `\nimport { useAuthStore } from '${importPath}';` + content.slice(lastMatch.index + lastMatch[0].length);
      }
    }

    // Add const { user } = useAuthStore(); if it doesn't exist
    if (!content.includes('const { user } = useAuthStore()') && !content.includes('const { user, isSuperAdmin } = useAuthStore()')) {
       // Insert it after the component declaration
       // E.g. export function Dashboard() {
       content = content.replace(/(export function [A-Za-z0-9_]+\([^)]*\)\s*{)/, "$1\n  const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';\n");
       content = content.replace(/(const [A-Za-z0-9_]+ = \([^)]*\)(?: \: [A-Za-z0-9_]+)? =>\s*{)/, "$1\n  const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';\n");
    } else {
       if (!content.includes('currentCompanyId')) {
         content = content.replace(/(const { user } = useAuthStore\(\);)/, "$1\n  const currentCompanyId = user?.companyId || '';\n");
       }
    }
    
    // Now replace common db queries
    // db.deliveryNotes.toArray() -> db.deliveryNotes.where('companyId').equals(currentCompanyId).toArray()
    const tables = ['customers', 'trucks', 'drivers', 'invoices', 'payments', 'deliveryNotes', 'deliveryNoteItems', 'products', 'productFamilies', 'productUnits', 'productPrices'];
    
    tables.forEach(table => {
      // db.table.toArray()
      content = content.replace(new RegExp(`db\\.${table}\\.toArray\\(\\)`, 'g'), `db.${table}.where('companyId').equals(currentCompanyId).toArray()`);
      
      // db.table.where('field').equals(val).toArray() -> db.table.where('field').equals(val).filter(x => x.companyId === currentCompanyId).toArray()
      content = content.replace(new RegExp(`db\\.${table}\\.where\\(([^)]+)\\)\\.equals\\(([^)]+)\\)\\.toArray\\(\\)`, 'g'), `db.${table}.where($1).equals($2).filter(x => x.companyId === currentCompanyId).toArray()`);
      content = content.replace(new RegExp(`db\\.${table}\\.where\\(([^)]+)\\)\\.anyOf\\(([^)]+)\\)\\.toArray\\(\\)`, 'g'), `db.${table}.where($1).anyOf($2).filter(x => x.companyId === currentCompanyId).toArray()`);
    });

    fs.writeFileSync(file, content, 'utf8');
    filesChanged++;
  }
});
console.log(`Changed ${filesChanged} files.`);
