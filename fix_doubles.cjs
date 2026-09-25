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

  // We injected:
  // const { user } = useAuthStore();
  // const currentCompanyId = user?.companyId || '';
  
  // If the file already had `const { user... } = useAuthStore();`, we now have two.
  // Actually, let's just let the script remove `const { user } = useAuthStore();\n  const currentCompanyId = user?.companyId || '';` if there's ANOTHER useAuthStore call in the component block.
  // Wait, no. The easiest is to just remove the old `const { ..., user, ... } = useAuthStore();` and keep ours, BUT if it had `logout`, we need to keep `logout`.
  
  // Let's replace:
  // const { user } = useAuthStore();
  // const currentCompanyId = user?.companyId || '';
  // ...
  // const { user, logout } = useAuthStore();
  
  // If we see two useAuthStore calls in the same component...
  // Let's just fix it by regex:
  
  if (content.match(/const \{ user \} = useAuthStore\(\);\r?\n[ \t]*const currentCompanyId = user\?\.companyId \|\| '';/)) {
     // Check if there is another useAuthStore call
     let parts = content.split('useAuthStore()');
     if (parts.length > 2) {
       // Yes! We have duplicates.
       // Let's combine them manually or replace `const { user, logout }` with `const { logout }`
       content = content.replace(/const \{([^}]+),?\s*user\s*,?([^}]*)\} = useAuthStore\(\);/g, (match, p1, p2) => {
           let newVars = [p1, p2].map(s => s.trim()).filter(Boolean).join(', ');
           if (newVars.endsWith(',')) newVars = newVars.slice(0, -1).trim();
           if (newVars.startsWith(',')) newVars = newVars.slice(1).trim();
           if (newVars) return `const { ${newVars} } = useAuthStore();`;
           return '';
       });
       
       content = content.replace(/const \{\s*user\s*,([^}]+)\} = useAuthStore\(\);/g, "const { $1 } = useAuthStore();");
       content = content.replace(/const \{([^}]+),\s*user\s*\} = useAuthStore\(\);/g, "const { $1 } = useAuthStore();");
       
       // Note: we just removed `user` from the second one!
       // But what if the second one was just `const { user } = useAuthStore();` ?
       // I'll manually run replace for `const { user } = useAuthStore();` if it appears twice.
       let userMatches = content.match(/const \{ user \} = useAuthStore\(\);/g);
       if (userMatches && userMatches.length > 1) {
           content = content.replace(/const \{ user \} = useAuthStore\(\);/, '%%FIRST_MATCH%%');
           content = content.replace(/const \{ user \} = useAuthStore\(\);\r?\n?/g, '');
           content = content.replace('%%FIRST_MATCH%%', 'const { user } = useAuthStore();');
       }
     }
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed double hook in " + file);
  }
});
