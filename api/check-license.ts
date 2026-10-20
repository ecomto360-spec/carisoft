import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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
  // En-têtes CORS pour Vercel serverless
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée. Seul POST est accepté.' });
  }

  const activatorEmail = process.env.ACTIVATOR_EMAIL;
  const activatorPassword = process.env.ACTIVATOR_PASSWORD;
  if (!activatorEmail || !activatorPassword) {
    console.error("Erreur 500: ACTIVATOR_EMAIL ou ACTIVATOR_PASSWORD manquant.");
    return res.status(500).json({
      error: "Erreur de configuration serveur : les identifiants ACTIVATOR_EMAIL et ACTIVATOR_PASSWORD sont manquants."
    });
  }

  try {
    const { key, tenantId, machineId } = req.body || {};
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: "Clé de licence obligatoire." });
    }

    const cleanKey = key.trim().toUpperCase();

    const app = getFirebaseClientApp();
    const auth = getAuth(app);

    // Authentification de l'activateur
    await signInWithEmailAndPassword(auth, activatorEmail, activatorPassword);

    const firestore = process.env.FIREBASE_DATABASE_ID
      ? getFirestore(app, process.env.FIREBASE_DATABASE_ID)
      : getFirestore(app);

    const licenseRef = doc(firestore, 'licenses', cleanKey);
    const snap = await getDoc(licenseRef);

    if (!snap.exists()) {
      return res.status(404).json({ 
        error: "Licence introuvable.", 
        status: "not_found",
        serverTime: new Date().toISOString()
      });
    }

    const data = snap.data();
    
    return res.status(200).json({
      status: data.status || 'unused',
      serverTime: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Erreur api/check-license:", error);
    return res.status(400).json({
      error: error.message || "Erreur lors de la vérification de la licence."
    });
  }
}