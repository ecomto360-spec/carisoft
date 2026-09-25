const fs = require('fs');

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// Find the block where user sync happens
const target = `          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            foundData = snap.data();
          }`;

const replacement = `          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            foundData = snap.data();
          } else if (user.companyId) {
            // Repair missing user document in Firestore (due to previous rule error)
            try {
              const { setDoc } = await import('firebase/firestore');
              await setDoc(userDocRef, {
                companyId: user.companyId,
                email: user.email,
                name: user.name,
                role: user.role,
                active: user.active,
                createdAt: new Date().toISOString()
              }, { merge: true });
              foundData = user;
            } catch (e) {
              console.error("Failed to repair missing user doc in Firestore", e);
            }
          }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync(path, content);
  console.log("Updated App.tsx to auto-repair missing user document");
} else {
  console.log("Target not found");
}
