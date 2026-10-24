import * as admin from 'firebase-admin';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

const adminApp: any = admin;

function initAdmin() {
  if (!adminApp.apps?.length && !adminApp.getApps?.()?.length) {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (serviceAccountEnv) {
      try {
        const serviceAccount = JSON.parse(serviceAccountEnv);
        adminApp.initializeApp({
          credential: adminApp.credential.cert(serviceAccount)
        });
      } catch (e) {
        console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:", e);
      }
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      adminApp.initializeApp({
        credential: adminApp.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
    } else {
      adminApp.initializeApp();
    }
  }
}

function signPayload(payloadObj: object, privateKeyBase64: string): string {
  const payloadJson = JSON.stringify(payloadObj);
  const payloadBytes = Buffer.from(payloadJson, 'utf8');
  const privKeyBytes = Buffer.from(privateKeyBase64, 'base64');
  let secretKey = privKeyBytes;
  if (privKeyBytes.length === 32) {
    const keyPair = nacl.sign.keyPair.fromSeed(privKeyBytes);
    secretKey = Buffer.from(keyPair.secretKey);
  }
  const signature = nacl.sign.detached(payloadBytes, secretKey);
  const payloadBase64 = payloadBytes.toString('base64');
  const signatureBase64 = Buffer.from(signature).toString('base64');
  return `${payloadBase64}.${signatureBase64}`;
}

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

export default async function handler(req: any, res: any) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Méthode non autorisée. Seul POST est accepté.' });
  }

  const privateKeyBase64 = process.env.LICENSE_PRIVATE_KEY;
  if (!privateKeyBase64) {
    console.error("Erreur 500: LICENSE_PRIVATE_KEY absente des variables d'environnement.");
    return res.status(500).json({
      success: false,
      error: "Erreur de configuration serveur : la clé privée LICENSE_PRIVATE_KEY est manquante."
    });
  }

  try {
    initAdmin();
    const db = adminApp.firestore();

    const { key, machineId, tenantId } = req.body || {};

    if (!key || typeof key !== 'string') {
      return res.status(400).json({ success: false, error: "Clé de licence obligatoire." });
    }
    if (!machineId || typeof machineId !== 'string') {
      return res.status(400).json({ success: false, error: "Identifiant PC (machineId) obligatoire." });
    }
    if (!tenantId || typeof tenantId !== 'string') {
      return res.status(400).json({ success: false, error: "Identifiant de l'entreprise (tenantId) obligatoire." });
    }

    const cleanKey = key.trim().toUpperCase();
    const cleanMachineId = machineId.trim();
    const cleanTenantId = tenantId.trim();

    const licenseRef = db.collection('licenses').doc(cleanKey);
    const serverTime = new Date().toISOString();
    const nowMs = Date.now();

    const result = await db.runTransaction(async (transaction: any) => {
      const docSnap = await transaction.get(licenseRef);

      if (!docSnap.exists) {
        throw new Error("Clé de licence introuvable ou inexistante.");
      }

      const data = docSnap.data() || {};

      // 1. Check revoked
      if (data.status === 'revoked') {
        throw new Error("Cette licence a été révoquée par l'administrateur.");
      }

      // 2. Check tenantId mismatch
      if (data.tenantId && data.tenantId !== cleanTenantId) {
        throw new Error("Cette licence n'est pas attribuée à cette entreprise (tenantId incompatible).");
      }

      let activatedAt = data.activatedAt;
      let expiresAt = data.expiresAt;
      const durationDays = Number(data.durationDays) || 30;

      // 3. Check expiration if already active
      if (expiresAt && new Date(expiresAt).getTime() < nowMs) {
        transaction.update(licenseRef, { status: 'expired', updatedAt: serverTime });
        throw new Error("Cette licence a expiré.");
      }

      if (data.status === 'unused' || !data.status) {
        // Activate unused license
        activatedAt = serverTime;
        expiresAt = new Date(nowMs + durationDays * 24 * 60 * 60 * 1000).toISOString();

        transaction.update(licenseRef, {
          status: 'active',
          machineId: cleanMachineId,
          tenantId: cleanTenantId || data.tenantId,
          activatedAt,
          expiresAt,
          updatedAt: serverTime
        });
      } else if (data.status === 'active') {
        // Check machineId match
        if (data.machineId && data.machineId !== cleanMachineId) {
          throw new Error("Licence déjà liée à un autre PC.");
        }
        // Same machineId -> reinstallation allowed, keep original expiresAt
        if (!data.machineId) {
          transaction.update(licenseRef, { machineId: cleanMachineId, updatedAt: serverTime });
        }
      } else if (data.status === 'expired') {
        throw new Error("Cette licence a expiré.");
      }

      return {
        key: cleanKey,
        tenantId: cleanTenantId || data.tenantId,
        machineId: cleanMachineId,
        activatedAt,
        expiresAt
      };
    });

    // Sign payload with Ed25519
    const payload = {
      key: result.key,
      tenantId: result.tenantId,
      machineId: result.machineId,
      activatedAt: result.activatedAt,
      expiresAt: result.expiresAt,
      serverTime
    };

    const token = signPayload(payload, privateKeyBase64);

    return res.status(200).json({
      success: true,
      token,
      serverTime
    });

  } catch (err: any) {
    console.error("Erreur api/activate-license:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Erreur lors de l'activation de la licence."
    });
  }
}
