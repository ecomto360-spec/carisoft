import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { readFileSync } from 'fs';

const firebaseConfig = JSON.parse(readFileSync('./firebase-applet-config.json'));
const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function backfill() {
  console.log("Fetching users...");
  const snap = await getDocs(collection(firestore, 'users'));
  console.log(`Found ${snap.docs.length} users`);
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.username && data.email) {
      console.log("Backfilling", data.username, "->", data.email);
      await setDoc(doc(firestore, 'username_mappings', data.username.toLowerCase()), { email: data.email });
    }
  }
  console.log("Done");
  process.exit(0);
}

backfill().catch(e => { console.error(e); process.exit(1); });
