/**
 * Script CLI autonome de génération de licences CARISOFT.next
 * Usage: npx ts-node scripts/generate-licenses.ts --count=5 --duration=90 --tenant=COMP-001 --firebase
 */

import * as fs from 'fs';
import * as path from 'path';

function generateKeyString(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const getBlock = (len: number) => {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let str = '';
    for (let i = 0; i < len; i++) {
      str += chars[arr[i] % chars.length];
    }
    return str;
  };
  return `CARI-${getBlock(4)}-${getBlock(4)}-${getBlock(4)}-${getBlock(4)}`;
}

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string, defaultVal: any) => {
    const found = args.find(arg => arg.startsWith(`--${name}=`));
    if (!found) return defaultVal;
    return found.split('=')[1];
  };

  const count = Number(getArg('count', '1'));
  const durationDays = Number(getArg('duration', '30'));
  const tenantId = getArg('tenant', '');
  const useFirebase = args.includes('--firebase');

  console.log(`\n--- Générateur de licences CARISOFT.next ---`);
  console.log(`Nombre : ${count}`);
  console.log(`Durée : ${durationDays} jours`);
  console.log(`TenantId : ${tenantId || '(aucun / universel)'}`);
  console.log(`Mode Firebase : ${useFirebase ? 'OUI (écriture Firestore)' : 'NON (fichier JSON local uniquement)'}\n`);

  const licenses: any[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < count; i++) {
    const key = generateKeyString();
    licenses.push({
      key,
      tenantId,
      durationDays,
      maxMachines: 1,
      status: 'unused',
      machineId: null,
      activatedAt: null,
      expiresAt: null,
      createdAt: now,
      createdBy: 'cli-script'
    });
  }

  const outputPath = path.resolve(process.cwd(), 'cles.json');
  fs.writeFileSync(outputPath, JSON.stringify(licenses, null, 2), 'utf-8');
  console.log(`[Succès] ${licenses.length} licence(s) sauvegardée(s) dans ${outputPath}`);

  if (useFirebase) {
    console.log(`[Firebase] Synchronisation avec Firestore...`);
    // Import dynamique du SDK client si --firebase est activé
    const { initializeApp } = await import('firebase/app');
    const { getAuth, signInWithEmailAndPassword } = await import('firebase/auth');
    const { getFirestore, doc, setDoc } = await import('firebase/firestore');

    const apiKey = process.env.FIREBASE_API_KEY;
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const email = process.env.ACTIVATOR_EMAIL;
    const password = process.env.ACTIVATOR_PASSWORD;

    if (!apiKey || !projectId || !email || !password) {
      console.error("[Erreur] Variables d'environnement Firebase manquantes (FIREBASE_API_KEY, FIREBASE_PROJECT_ID, ACTIVATOR_EMAIL, ACTIVATOR_PASSWORD).");
      process.exit(1);
    }

    const app = initializeApp({ apiKey, projectId, authDomain: `${projectId}.firebaseapp.com` });
    const auth = getAuth(app);
    await signInWithEmailAndPassword(auth, email, password);

    const firestore = process.env.FIREBASE_DATABASE_ID
      ? getFirestore(app, process.env.FIREBASE_DATABASE_ID)
      : getFirestore(app);

    for (const lic of licenses) {
      const docRef = doc(firestore, 'licenses', lic.key);
      await setDoc(docRef, {
        tenantId: lic.tenantId,
        durationDays: lic.durationDays,
        maxMachines: lic.maxMachines,
        status: lic.status,
        machineId: lic.machineId,
        activatedAt: lic.activatedAt,
        expiresAt: lic.expiresAt,
        createdAt: lic.createdAt,
        createdBy: lic.createdBy
      });
      console.log(`  -> Écrit dans Firestore : ${lic.key}`);
    }
    console.log(`[Succès] Toutes les licences ont été synchronisées dans Firestore !`);
  }
}

main().catch(err => {
  console.error("Erreur critique script:", err);
  process.exit(1);
});
