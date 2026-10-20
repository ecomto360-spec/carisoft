import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// Configuration Firebase
function getFirebaseClientApp() {
  const existing = getApps();
  if (existing.length > 0) {
    return getApp();
  }
  const apiKey = process.env.FIREBASE_API_KEY;
  const projectId = process.env.FIREBASE_PROJECT_ID;

  if (!apiKey || !projectId) {
    throw new Error("Variables d'environnement Firebase obligatoires.");
  }

  return initializeApp({
    apiKey,
    projectId,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`
  });
}

export default async function handler(req: any, res: any) {
  // En-têtes CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const { action, params } = req.body || {};
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: "Token d'authentification manquant." });
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    // 1. Vérifier l'identité de l'appelant via Identity Toolkit
    const verifyRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    
    const verifyData = await verifyRes.json();
    if (!verifyData.users || verifyData.users.length === 0) {
      return res.status(401).json({ error: "Token invalide ou expiré." });
    }

    const email = verifyData.users[0].email;
    const superAdmins = (process.env.SUPERADMIN_EMAILS || "").split(',').map((e: string) => e.trim());
    
    if (!superAdmins.includes(email)) {
      return res.status(403).json({ error: "Accès SuperAdmin requis. Votre compte n'est pas autorisé." });
    }

    // 2. Initialiser Firebase et authentifier l'activateur
    const app = getFirebaseClientApp();
    const auth = getAuth(app);
    
    await signInWithEmailAndPassword(auth, process.env.ACTIVATOR_EMAIL!, process.env.ACTIVATOR_PASSWORD!);
    
    const firestore = process.env.FIREBASE_DATABASE_ID
      ? getFirestore(app, process.env.FIREBASE_DATABASE_ID)
      : getFirestore(app);

    // 3. Traiter l'action demandée
    if (action === 'create') {
      const { tenantId, durationDays = 90, maxMachines = 1 } = params || {};
      
      // Générer une clé CARI-XXXX-XXXX-XXXX-XXXX
      const segments = [];
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Sans 0, O, 1, I
      for (let i = 0; i < 4; i++) {
        let seg = "";
        for (let j = 0; j < 4; j++) {
          seg += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        segments.push(seg);
      }
      const key = `CARI-${segments.join('-')}`;
      
      const now = new Date().toISOString();
      const licenseRef = doc(firestore, 'licenses', key);

      await setDoc(licenseRef, {
        tenantId: tenantId || "",
        durationDays: Number(durationDays) || 90,
        maxMachines: Number(maxMachines) || 1,
        status: "unused",
        machineId: "",
        activatedAt: "",
        expiresAt: "",
        createdAt: now,
        createdBy: email
      });

      return res.status(200).json({ 
        success: true, 
        key, 
        message: "Licence générée avec succès.",
        details: {
          tenantId: tenantId || "Non attribué",
          durationDays: Number(durationDays) || 90,
          maxMachines: Number(maxMachines) || 1
        }
      });
    }

    if (action === 'revoke') {
      const { key } = params || {};
      if (!key) {
        return res.status(400).json({ error: "Clé de licence obligatoire pour la révocation." });
      }

      const licenseRef = doc(firestore, 'licenses', key);
      const snap = await getDoc(licenseRef);

      if (!snap.exists()) {
        return res.status(404).json({ error: "Licence introuvable." });
      }

      await updateDoc(licenseRef, {
        status: "revoked",
        revokedAt: new Date().toISOString(),
        revokedBy: email
      });

      return res.status(200).json({ 
        success: true, 
        message: "Licence révoquée avec succès." 
      });
    }

    if (action === 'list') {
      // Optionnel : lister les licences (nécessiterait une requête Firestore plus complexe)
      return res.status(200).json({ 
        success: true, 
        message: "Action 'list' non implémentée dans cette version." 
      });
    }

    return res.status(400).json({ error: "Action non reconnue. Utilisez 'create', 'revoke' ou 'list'." });

  } catch (error: any) {
    console.error("Erreur api/admin-licenses:", error);
    return res.status(500).json({ 
      error: error.message || "Erreur interne lors de la gestion des licences." 
    });
  }
}