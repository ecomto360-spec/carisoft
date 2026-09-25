const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
    `allow create: if isSuperAdmin() || (isAuthenticated() && (request.resource.data.companyId == getUserCompanyId() || request.auth.uid == userId));`,
    `allow create: if isSuperAdmin() || (isAuthenticated() && (request.auth.uid == userId || request.resource.data.companyId == getUserCompanyId()));`
);

content = content.replace(
    `    function getUserCompanyId() {
      // Fallback to reading the doc if custom claims aren't fully propagated yet
      return request.auth.token.companyId != null 
        ? request.auth.token.companyId 
        : get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId;
    }`,
    `    function getUserCompanyId() {
      // Fallback to reading the doc if custom claims aren't fully propagated yet
      return request.auth.token.companyId != null 
        ? request.auth.token.companyId 
        : (exists(/databases/$(database)/documents/users/$(request.auth.uid)) 
            ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId 
            : null);
    }`
);

fs.writeFileSync('firestore.rules', content);
console.log('Updated firestore.rules');
