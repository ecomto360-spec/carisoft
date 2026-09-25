import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';
const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json'));
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const q = query(collection(firestore, 'users'), where('username', '==', 'berkani'));
getDocs(q).then(snap => {
  console.log("Found username:", snap.size);
  snap.forEach(doc => console.log(doc.data()));
}).catch(console.error);
