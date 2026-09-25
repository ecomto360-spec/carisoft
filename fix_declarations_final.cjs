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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('currentCompanyId')) {
    // 1. Remove ALL occurrences of:
    // const { user } = useAuthStore();
    // const currentCompanyId = user?.companyId || '';
    
    // We will do this via a regex that matches const {.*user.*} = useAuthStore();
    content = content.replace(/[ \t]*const[ \t]*\{[^}]*user[^}]*\}[ \t]*=[ \t]*useAuthStore\(\);\r?\n?/g, '');
    content = content.replace(/[ \t]*const[ \t]*currentCompanyId[ \t]*=[ \t]*user\?\.companyId[ \t]*\|\|[ \t]*'';\r?\n?/g, '');
    
    // 2. Now insert them correctly right after the main function component declaration
    // We can assume the component is exported like: export function Dashboard() {
    // or export const DeliveryList = () => {
    
    // regex to find component signature
    content = content.replace(/(export (?:default )?function [A-Za-z0-9_]+\([^)]*\)(?:\s*:\s*[A-Za-z0-9_<>]+)?\s*{)/, "$1\n  const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';\n");
    content = content.replace(/(export const [A-Za-z0-9_]+ = \([^)]*\)(?:\s*:\s*[A-Za-z0-9_<>]+)? =>\s*{)/, "$1\n  const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';\n");
    
    // What if it's not exported?
    content = content.replace(/(\nfunction [A-Za-z0-9_]+\([^)]*\)(?:\s*:\s*[A-Za-z0-9_<>]+)?\s*{)/, "$1\n  const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';\n");
    content = content.replace(/(\nconst [A-Za-z0-9_]+ = \([^)]*\)(?:\s*:\s*[A-Za-z0-9_<>]+)? =>\s*{)/, "$1\n  const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';\n");
    
    // De-duplicate if it inserted multiple times
    // (though our replacement might replace multiple function declarations in the file, that's okay as long as they need user)
    // Actually, only replace the first match of the component!
    
    changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed component scope in " + file);
  }
});
