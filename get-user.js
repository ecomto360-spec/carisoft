import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json'));
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  const q = query(collection(firestore, 'users'), where('username', '==', 'berkani'));
  const snap = await getDocs(q);
  snap.forEach(d => console.log(d.data()));
  console.log("Done");
}

run().catch(console.error);
