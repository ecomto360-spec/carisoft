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

  if (content.includes('currentCompanyId = user?.companyId')) {
    if (!content.includes('const { user } = useAuthStore()') && !content.includes('const { user,') && !content.includes(', user } = useAuthStore()')) {
       // We need to inject const { user } = useAuthStore(); right before currentCompanyId
       content = content.replace(/(const currentCompanyId = user\?\.companyId \|\| '';)/, "const { user } = useAuthStore();\n  $1");
       changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed missing user in " + file);
  }
});
