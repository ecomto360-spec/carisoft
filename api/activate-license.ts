import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, runTransaction } from 'firebase/firestore';
import nacl from 'tweetnacl';

// Initialisation du SDK client Firebase côté serveur
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

  // 1. Vérification de la clé privée Ed25519 (strictement aucune clé par défaut)
  const privateKeyBase64 = process.env.LICENSE_PRIVATE_KEY;
  if (!privateKeyBase64) {
    console.error("Erreur 500: LICENSE_PRIVATE_KEY absente des variables d'environnement.");
    return res.status(500).json({
      success: false,
      error: "Erreur de configuration serveur : la clé privée LICENSE_PRIVATE_KEY est manquante."
    });
  }

  // 2. Vérification des identifiants activator
  const activatorEmail = process.env.ACTIVATOR_EMAIL;
  const activatorPassword = process.env.ACTIVATOR_PASSWORD;
  if (!activatorEmail || !activatorPassword) {
    console.error("Erreur 500: ACTIVATOR_EMAIL ou ACTIVATOR_PASSWORD manquant.");
    return res.status(500).json({
      success: false,
      error: "Erreur de configuration serveur : les identifiants ACTIVATOR_EMAIL et ACTIVATOR_PASSWORD sont manquants."
    });
  }

  try {
    const { key, machineId, tenantId } = req.body || {};

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ error: "Clé de licence obligatoire." });
    }
    if (!machineId || typeof machineId !== 'string') {
      return res.status(400).json({ error: "Identifiant PC (machineId) obligatoire." });
    }
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ error: "Identifiant de l'entreprise (tenantId) obligatoire." });
    }

    const cleanKey = key.trim().toUpperCase();
    const cleanMachineId = machineId.trim();
    const cleanTenantId = tenantId.trim();

    // 3. Initialisation du SDK client Firebase
    const app = getFirebaseClientApp();
    const auth = getAuth(app);

    // Authentification du compte activator
    await signInWithEmailAndPassword(auth, activatorEmail, activatorPassword);

    // Initialisation Firestore (avec databaseId si spécifié)
    const firestore = process.env.FIREBASE_DATABASE_ID
      ? getFirestore(app, process.env.FIREBASE_DATABASE_ID)
      : getFirestore(app);

    const licenseRef = doc(firestore, 'licenses', cleanKey);

    // 4. Transaction Firestore garantissant l'atomicité de l'activation
    const activationResult = await runTransaction(firestore, async (transaction) => {
      const docSnap = await transaction.get(licenseRef);

      if (!docSnap.exists()) {
        throw new Error("Clé de licence introuvable ou inexistante.");
      }

      const licenseData = docSnap.data();

      // Règle 1 : Clé révoquée
      if (licenseData.status === 'revoked') {
        throw new Error("Cette licence a été révoquée par l'administrateur.");
      }

      // Règle 2 : Vérification du tenantId
      if (licenseData.tenantId && licenseData.tenantId !== cleanTenantId) {
        throw new Error("Cette licence n'est pas attribuée à cette entreprise (tenantId incompatible).");
      }

      const now = new Date();

      // Règle 3 : Statut "unused" (1re activation)
      if (licenseData.status === 'unused' || !licenseData.status) {
        const durationDays = Number(licenseData.durationDays) || 30;
        const activatedAt = now.toISOString();
        const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

        transaction.update(licenseRef, {
          tenantId: cleanTenantId,
          machineId: cleanMachineId,
          activatedAt,
          expiresAt,
          status: 'active',
          updatedAt: now.toISOString()
        });

        return {
          key: cleanKey,
          tenantId: cleanTenantId,
          machineId: cleanMachineId,
          activatedAt,
          expiresAt
        };
      }

      // Règle 4 : Statut "active"
      if (licenseData.status === 'active') {
        // Vérifier si la date d'expiration est déjà dépassée
        if (licenseData.expiresAt && new Date(licenseData.expiresAt).getTime() < now.getTime()) {
          transaction.update(licenseRef, { status: 'expired', updatedAt: now.toISOString() });
          throw new Error("Cette licence est expirée.");
        }

        // Même machineId -> réinstallation / reconnexion autorisée
        if (licenseData.machineId === cleanMachineId) {
          return {
            key: cleanKey,
            tenantId: cleanTenantId,
            machineId: cleanMachineId,
            activatedAt: licenseData.activatedAt,
            expiresAt: licenseData.expiresAt
          };
        }

        // MachineId différent -> Refus strict (liée à un seul PC)
        throw new Error("Licence déjà utilisée sur un autre ordinateur.");
      }

      // Règle 5 : Statut "expired"
      if (licenseData.status === 'expired') {
        throw new Error("Cette licence est expirée.");
      }

      throw new Error("Statut de licence inconnu.");
    });

    // 5. Signature cryptographique Ed25519
    const privateKeyBytes = new Uint8Array(Buffer.from(privateKeyBase64, 'base64'));
    const payloadString = JSON.stringify(activationResult);
    const payloadBytes = new Uint8Array(Buffer.from(payloadString, 'utf8'));

    // Signature détachée Ed25519
    const signatureBytes = nacl.sign.detached(payloadBytes, privateKeyBytes);
    const signatureBase64 = Buffer.from(signatureBytes).toString('base64');
    const payloadBase64 = Buffer.from(payloadString, 'utf8').toString('base64');

    const signedToken = `${payloadBase64}.${signatureBase64}`;

    // 6. Ajout de serverTime pour la vérification d'horloge
    return res.status(200).json({
      success: true,
      token: signedToken,
      payload: activationResult,
      signature: signatureBase64,
      serverTime: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Erreur api/activate-license:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Erreur interne lors de l'activation de la licence."
    });
  }
}