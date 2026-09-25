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

  // We injected `const { user } = useAuthStore();` directly after function declarations
  // If there's another declaration `const { ..., user, ... } = useAuthStore();`, it causes errors.
  
  if (content.match(/const \{ user \} = useAuthStore\(\);[\s\S]*const \{.*user.*\} = useAuthStore\(\);/)) {
     // Remove the one we injected
     content = content.replace(/const \{ user \} = useAuthStore\(\);\n/, '');
     changed = true;
  }
  
  if (content.match(/const \{.*user.*\} = useAuthStore\(\);[\s\S]*const \{ user \} = useAuthStore\(\);/)) {
     // Remove the one we injected
     content = content.replace(/const \{ user \} = useAuthStore\(\);\n/, '');
     changed = true;
  }
  
  // also check if we injected twice
  if (content.split('const { user } = useAuthStore();').length > 2) {
      content = content.replace('const { user } = useAuthStore();\n', '');
      changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed " + file);
  }
});
