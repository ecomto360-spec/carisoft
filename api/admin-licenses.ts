import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import crypto from 'crypto';

const ALLOWED_ORIGINS = [
  'https://carisoft.vercel.app',
  'https://tauri.localhost',
  'http://tauri.localhost',
  'tauri://localhost',
  'http://localhost:5173'
];

function setCors(req: any, res: any) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', 'https://carisoft.vercel.app');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
}

const admin = {
  get apps() {
    return getApps();
  }
};

function initAdmin() {
  if (!admin.apps || admin.apps.length === 0) {
    const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountRaw) {
      throw new Error("Variable d'environnement FIREBASE_SERVICE_ACCOUNT manquante.");
    }
    return initializeApp({
      credential: cert(JSON.parse(serviceAccountRaw))
    });
  }
  return admin.apps.find(a => a.name === '[DEFAULT]') || getApp();
}

function getAuthApp() {
  let authApp = admin.apps.find(a => a.name === 'auth');
  if (!authApp) {
    authApp = initializeApp({ projectId: process.env.AUTH_PROJECT_ID }, 'auth');
  }
  return authApp;
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
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Méthode non autorisée.' });
  }

  try {
    const defaultApp = initAdmin();
    const authApp = getAuthApp();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: "Jeton d'authentification manquant." });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await getAuth(authApp).verifyIdToken(idToken);

    const superAdminEmails = (process.env.SUPERADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
    const userEmail = (decodedToken.email || '').toLowerCase();
    const isAdminClaim = decodedToken.admin === true || decodedToken.role === 'superadmin';
    const isSuperAdminEmail = superAdminEmails.includes(userEmail) && decodedToken.email_verified === true;

    if (!isAdminClaim && !isSuperAdminEmail) {
      return res.status(403).json({ success: false, error: "Accès refusé : privilèges SuperAdmin requis." });
    }

    const db = getFirestore(defaultApp);
    const { action, key, durationDays = 30, tenantId = '', maxMachines = 1, extendDays = 30 } = req.body || {};

    if (action === 'create') {
      let generatedKey = '';
      let exists = true;
      let attempts = 0;

      while (exists && attempts < 10) {
        generatedKey = generateKeyString();
        const docRef = db.collection('licenses').doc(generatedKey);
        const snap = await docRef.get();
        exists = snap.exists;
        attempts++;
      }

      if (exists) {
        return res.status(500).json({ success: false, error: "Impossible de générer une clé unique." });
      }

      const nowIso = new Date().toISOString();
      const licenseData = {
        tenantId: typeof tenantId === 'string' ? tenantId.trim() : '',
        durationDays: Number(durationDays) || 30,
        maxMachines: Number(maxMachines) || 1,
        status: 'unused',
        machineId: '',
        activatedAt: '',
        expiresAt: '',
        createdAt: nowIso,
        createdBy: decodedToken.email || 'superadmin'
      };

      await db.collection('licenses').doc(generatedKey).set(licenseData);

      return res.status(200).json({
        success: true,
        key: generatedKey,
        ...licenseData
      });
    }

    if (action === 'list') {
      const snapshot = await db.collection('licenses').get();
      const licenses = snapshot.docs.map((doc: any) => ({
        key: doc.id,
        id: doc.id,
        ...doc.data()
      }));
      return res.status(200).json({ success: true, licenses });
    }

    if (action === 'revoke') {
      if (!key) return res.status(400).json({ success: false, error: "Clé requise pour la révocation." });
      const ref = db.collection('licenses').doc(key.trim().toUpperCase());
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ success: false, error: "Licence introuvable." });

      const nowIso = new Date().toISOString();
      await ref.update({ status: 'revoked', revokedAt: nowIso, updatedAt: nowIso });
      return res.status(200).json({ success: true, message: "Licence révoquée avec succès." });
    }

    if (action === 'extend') {
      if (!key) return res.status(400).json({ success: false, error: "Clé requise pour l'extension." });
      const ref = db.collection('licenses').doc(key.trim().toUpperCase());
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ success: false, error: "Licence introuvable." });

      const data = snap.data() || {};
      if (data.status === 'revoked') {
        return res.status(400).json({ success: false, error: "Impossible de prolonger une licence révoquée." });
      }

      const addDays = Number(extendDays) || 30;
      const nowIso = new Date().toISOString();

      if (data.status === 'unused' || !data.status || !data.expiresAt) {
        // Si unused, augmenter durationDays sans changer status/expiresAt
        const currentDuration = Number(data.durationDays) || 30;
        await ref.update({
          durationDays: currentDuration + addDays,
          updatedAt: nowIso
        });
        return res.status(200).json({ success: true, message: `Durée initiale augmentée de ${addDays} jours.` });
      }

      // Si active ou expired, étendre expiresAt (et remettre active si expired)
      let currentExpires = new Date(data.expiresAt);
      if (isNaN(currentExpires.getTime()) || currentExpires.getTime() < Date.now()) {
        currentExpires = new Date();
      }
      const newExpires = new Date(currentExpires.getTime() + addDays * 24 * 60 * 60 * 1000).toISOString();

      await ref.update({
        expiresAt: newExpires,
        status: 'active',
        updatedAt: nowIso
      });

      return res.status(200).json({ success: true, message: `Licence prolongée de ${addDays} jours.`, expiresAt: newExpires });
    }

    if (action === 'delete') {
      if (!key) return res.status(400).json({ success: false, error: "Clé requise pour la suppression." });
      const ref = db.collection('licenses').doc(key.trim().toUpperCase());
      await ref.delete();
      return res.status(200).json({ success: true, message: "Licence supprimée." });
    }

    return res.status(400).json({ success: false, error: "Action non reconnue." });

  } catch (err: any) {
    console.error("Erreur api/admin-licenses:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Erreur serveur administrateur des licences."
    });
  }
}
