import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, updateDoc, getDoc } from 'firebase/firestore';

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

  if (!activatorEmail || !activatorPassword) {
    return res.status(500).json({ success: false, error: "Configuration serveur incomplète (activateur)." });
  }

  try {
    const { key } = req.body || {};

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ success: false, error: "Clé de licence obligatoire." });
    }

    const cleanKey = key.trim().toUpperCase();

    const app = getFirebaseClientApp();
    const auth = getAuth(app);
    await signInWithEmailAndPassword(auth, activatorEmail, activatorPassword);

    const firestore = process.env.FIREBASE_DATABASE_ID
      ? getFirestore(app, process.env.FIREBASE_DATABASE_ID)
      : getFirestore(app);

    const docRef = doc(firestore, 'licenses', cleanKey);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return res.status(404).json({ success: false, error: "Licence introuvable." });
    }

    const now = new Date().toISOString();
    await updateDoc(docRef, {
      status: 'revoked',
      revokedAt: now,
      updatedAt: now
    });

    return res.status(200).json({
      success: true,
      message: `Licence ${cleanKey} révoquée avec succès.`
    });

  } catch (err: any) {
    console.error("Erreur api/revoke-key:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Erreur lors de la révocation de la licence."
    });
  }
}
