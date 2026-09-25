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

  // We have "    const currentCompanyId = user?.companyId || '';" before "const { user..."
  // Remove all instances of currentCompanyId before useAuthStore
  
  if (content.match(/const currentCompanyId = user\?\.companyId \|\| '';[\s\S]*useAuthStore\(\);/)) {
      content = content.replace(/.*const currentCompanyId = user\?\.companyId \|\| '';\n?/g, '');
      content = content.replace(/(const {.*user.*} = useAuthStore\(\);)/g, "$1\n  const currentCompanyId = user?.companyId || '';");
      changed = true;
  }

  // Deduplicate currentCompanyId
  if (content.split('const currentCompanyId = user?.companyId || \'\';').length > 2) {
      // Keep only the first one
      let parts = content.split('const currentCompanyId = user?.companyId || \'\';');
      content = parts[0] + 'const currentCompanyId = user?.companyId || \'\';' + parts.slice(1).join('');
      changed = true;
  }
  
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed reference in " + file);
  }
});
