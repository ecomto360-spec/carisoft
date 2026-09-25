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

  // db.products.filter(p => p.active && ( ...
  // to
  // db.products.where('companyId').equals(currentCompanyId).filter(p => p.active && ( ...

  // Pattern: db\.[a-zA-Z0-9_]+\.filter\(
  // BUT avoid replacing if it already has .where('companyId').equals(currentCompanyId) before .filter!
  
  content = content.replace(/db\.([a-zA-Z0-9_]+)\.filter\(/g, (match, table) => {
    // If we are dealing with settings or users, don't scope by companyId (wait, users are scoped, but let's avoid touching them just in case, actually users might need it but they are usually fetched differently)
    if (table === 'settings' || table === 'users') return match;
    
    // Check if the match is preceded by .where('companyId').equals(currentCompanyId)
    // In our regex we can't easily lookbehind in JS safely for variable lengths, but we can just do it in two steps.
    return `db.${table}._FILTER_MARK_(`;
  });
  
  // Now replace db.table.toArray() that has NO filter or where clause!
  // e.g. db.conventions.toArray()
  content = content.replace(/db\.([a-zA-Z0-9_]+)\.toArray\(\)/g, (match, table) => {
    if (table === 'settings' || table === 'users') return match;
    return `db.${table}.where('companyId').equals(currentCompanyId).toArray()`;
  });

  // Re-apply the filter mark, but only if it's not already preceded by .equals(currentCompanyId)
  // Actually, let's just restore it safely.
  
  // We want to turn db.table._FILTER_MARK_ into db.table.where('companyId').equals(currentCompanyId).filter
  // UNLESS it's already db.table.where('companyId').equals(currentCompanyId)._FILTER_MARK_
  
  content = content.replace(/\.equals\(currentCompanyId\)\._FILTER_MARK_\(/g, ".equals(currentCompanyId).filter(");
  content = content.replace(/db\.([a-zA-Z0-9_]+)\._FILTER_MARK_\(/g, "db.$1.where('companyId').equals(currentCompanyId).filter(");


  // Fix any permissive (!c.companyId || !currentUser?.companyId || c.companyId === currentUser?.companyId)
  content = content.replace(/\(![a-zA-Z0-9_]+\.companyId[ \t]*\|\|[ \t]*![a-zA-Z0-9_]+\?\.companyId[ \t]*\|\|[ \t]*([a-zA-Z0-9_]+)\.companyId[ \t]*===[ \t]*([a-zA-Z0-9_]+)\?\.companyId\)/g, "($1.companyId === $2?.companyId)");

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed permissive filters in " + file);
  }
});
