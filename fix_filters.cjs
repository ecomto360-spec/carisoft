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
  let original = content;

  // Let's replace (!c.companyId || !currentUser?.companyId || c.companyId === currentUser?.companyId)
  // with (c.companyId === currentCompanyId)
  
  // This might be tricky if it's named something else. Let's just do a regex replace for the condition:
  // \(![a-zA-Z0-9_]+\.companyId \|\| ![a-zA-Z0-9_]+\?\.companyId \|\| [a-zA-Z0-9_]+\.companyId === [a-zA-Z0-9_]+\?\.companyId\)
  
  content = content.replace(/\(![a-zA-Z0-9_]+\.companyId[ \t]*\|\|[ \t]*![a-zA-Z0-9_]+\?\.companyId[ \t]*\|\|[ \t]*([a-zA-Z0-9_]+)\.companyId[ \t]*===[ \t]*([a-zA-Z0-9_]+)\?\.companyId\)/g, "($1.companyId === $2?.companyId)");

  // Also fix ClientList directly if needed.
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed permissive filter in " + file);
  }
});
