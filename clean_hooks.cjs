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

  // Remove ALL instances of the injected code (accounting for potential whitespace variations)
  content = content.replace(/^[ \t]*const \{ user \} = useAuthStore\(\);\r?\n?/gm, '');
  content = content.replace(/^[ \t]*const currentCompanyId = user\?\.companyId \|\| '';\r?\n?/gm, '');

  if (content !== original) {
    // We need to inject it back ONCE in the main component.
    // Usually the main component is the one exported by default or the one matching the filename.
    // Let's just find the first `export function` or `export default function` or `export const <CapitalLetter>`
    
    const componentMatch = content.match(/export (?:default )?(?:function [A-Z][A-Za-z0-9_]*\([^)]*\)(?:\s*:\s*[A-Za-z0-9_<>]+)?\s*{|const [A-Z][A-Za-z0-9_]* = \([^)]*\)(?:\s*:\s*[A-Za-z0-9_<>]+)? =>\s*{)/);
    
    if (componentMatch) {
       let insertIdx = componentMatch.index + componentMatch[0].length;
       content = content.slice(0, insertIdx) + "\n  const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';" + content.slice(insertIdx);
    } else {
       // fallback: first function that returns JSX? Or just find the first function that starts with Capital letter
       const anyComp = content.match(/(?:function [A-Z][A-Za-z0-9_]*\([^)]*\)(?:\s*:\s*[A-Za-z0-9_<>]+)?\s*{|const [A-Z][A-Za-z0-9_]* = \([^)]*\)(?:\s*:\s*[A-Za-z0-9_<>]+)? =>\s*{)/);
       if (anyComp) {
         let insertIdx = anyComp.index + anyComp[0].length;
         content = content.slice(0, insertIdx) + "\n  const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';" + content.slice(insertIdx);
       }
    }
    
    // Check if we need to remove useAuthStore import if it's unused now (we don't strictly have to, but good to know)
    // Actually, if we just inserted it, it IS used.

    fs.writeFileSync(file, content, 'utf8');
    console.log("Cleaned and fixed " + file);
  }
});
