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

  // Fix wrong import paths for useAuthStore
  // The correct relative path depends on the file's location relative to src/store
  
  if (content.includes("from '../store/authStore'")) {
     const rel = path.relative(path.dirname(file), path.join(__dirname, 'src/store/authStore'));
     let importPath = rel.replace(/\\/g, '/');
     if (!importPath.startsWith('.')) {
        importPath = './' + importPath;
     }
     
     content = content.replace(/from '\.\.\/store\/authStore'/g, `from '${importPath}'`);
     changed = true;
  }
  
  if (content.includes("from '../../store/authStore'")) {
     const rel = path.relative(path.dirname(file), path.join(__dirname, 'src/store/authStore'));
     let importPath = rel.replace(/\\/g, '/');
     if (!importPath.startsWith('.')) {
        importPath = './' + importPath;
     }
     content = content.replace(/from '\.\.\/\.\.\/store\/authStore'/g, `from '${importPath}'`);
     changed = true;
  }

  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed import in " + file);
  }
});
