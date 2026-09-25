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

const tablesToFix = ['customerFamilies', 'conventions', 'productFamilies', 'productUnits'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  tablesToFix.forEach(table => {
     // replace db.table.where('companyId').equals(currentCompanyId).toArray()
     // with db.table.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()
     
     let regex1 = new RegExp(`db\\.${table}\\.where\\('companyId'\\)\\.equals\\(currentCompanyId\\)\\.toArray\\(\\)`, 'g');
     content = content.replace(regex1, `db.${table}.filter(x => !x.companyId || x.companyId === currentCompanyId).toArray()`);

     // replace db.table.where('companyId').equals(currentCompanyId).filter(...)
     // with db.table.filter(x => (!x.companyId || x.companyId === currentCompanyId) && ...)
     
     // This might be harder to regex generically if there's a lambda.
     // Let's just do a specific replace for the cases we know.
     // Actually, let's see if there are any .where('companyId').equals(currentCompanyId).filter(
     let regex2 = new RegExp(`db\\.${table}\\.where\\('companyId'\\)\\.equals\\(currentCompanyId\\)\\.filter\\(([^=]+)=>`, 'g');
     content = content.replace(regex2, `db.${table}.filter($1 => (!$1.companyId || $1.companyId === currentCompanyId) &&`);
  });

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed global templates in " + file);
  }
});
