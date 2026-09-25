const fs = require('fs');
const path = require('path');
const glob = require('glob'); // Not available? We can use recursive fs.readdirSync

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

  // Replace db.table.toArray() with db.table.where('companyId').equals(tenantId).toArray()
  // But wait, how do we get tenantId? From useAuthStore!
  
  if (content.includes('db.') && content.includes('useLiveQuery')) {
     // This is too complex for a regex because there are many ways db is queried.
  }
});
