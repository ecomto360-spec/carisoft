import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

function getFirebaseClientApp() {
  const existing = getApps();
  if (existing.length > 0) {
    return getApp();
  }
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error("Variables d'environnement FIREBASE_API_KEY et FIREBASE_PROJECT_ID obligatoires.");
  }

  return initializeApp({
    apiKey,
    projectId,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`
  });
}

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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Méthode non autorisée. Seul POST est accepté.' });
  }

  const activatorEmail = process.env.ACTIVATOR_EMAIL;
  const activatorPassword = process.env.ACTIVATOR_PASSWORD;
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());

  if (!activatorEmail || !activatorPassword) {
    return res.status(500).json({ success: false, error: "Configuration serveur incomplète (activateur)." });
  }

  try {
    // Vérification optionnelle de l'admin appelant via le header Authorization (Bearer token)
    // Note: Le frontend ou l'appelant transmet l'idToken si authentifié côté client
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Optionnel : vérification du token utilisateur
    }

    const { count = 1, durationDays = 30, tenantId = '', maxMachines = 1 } = req.body || {};

    const numCount = Math.max(1, Math.min(100, Number(count) || 1));
    const numDuration = Number(durationDays) || 30;
    const cleanTenantId = typeof tenantId === 'string' ? tenantId.trim() : '';

    const app = getFirebaseClientApp();
    const auth = getAuth(app);
    await signInWithEmailAndPassword(auth, activatorEmail, activatorPassword);

    const firestore = process.env.FIREBASE_DATABASE_ID
      ? getFirestore(app, process.env.FIREBASE_DATABASE_ID)
      : getFirestore(app);

    const generatedLicenses: any[] = [];
    const now = new Date().toISOString();

    for (let i = 0; i < numCount; i++) {
      let key = '';
      let exists = true;
      let attempts = 0;

      while (exists && attempts < 10) {
        key = generateKeyString();
        const docRef = doc(firestore, 'licenses', key);
        const snap = await getDoc(docRef);
        exists = snap.exists();
        attempts++;
      }

      if (exists) {
        throw new Error("Impossible de générer une clé unique après plusieurs tentatives.");
      }

      const licenseData = {
        tenantId: cleanTenantId,
        durationDays: numDuration,
        maxMachines: Number(maxMachines) || 1,
        status: 'unused',
        machineId: null,
        activatedAt: null,
        expiresAt: null,
        createdAt: now,
        createdBy: activatorEmail
      };

      const docRef = doc(firestore, 'licenses', key);
      await setDoc(docRef, licenseData);

      generatedLicenses.push({
        key,
        ...licenseData
      });
    }

    return res.status(200).json({
      success: true,
      count: generatedLicenses.length,
      licenses: generatedLicenses
    });

  } catch (err: any) {
    console.error("Erreur api/generate-keys:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Erreur lors de la génération des clés."
    });
  }
}
