import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { readFileSync } from 'fs';
const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json'));
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
createUserWithEmailAndPassword(auth, 'test2@carisoft.com', 'password123')
  .then(console.log)
  .catch(console.error);
