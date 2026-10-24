import { getFirestore } from 'firebase-admin/firestore';
import * as admin from 'firebase-admin';
import nacl from 'tweetnacl';
import { Buffer } from 'buffer';

const adminApp: any = admin;

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

export default async function handler(req: any, res: any) {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Méthode non autorisée.' });
  }

  const privateKeyBase64 = process.env.LICENSE_PRIVATE_KEY;
  if (!privateKeyBase64) {
    return res.status(500).json({ success: false, error: "Configuration serveur incomplète (LICENSE_PRIVATE_KEY manquante)." });
  }

  try {
    initAdmin();
    const db = (process.env.FIREBASE_DATABASE_ID ? getFirestore(adminApp.app(), process.env.FIREBASE_DATABASE_ID) : getFirestore(adminApp.app()));

    const { key, machineId } = req.body || {};
    if (!key || typeof key !== 'string') {
      return res.status(400).json({ success: false, error: "Clé de licence obligatoire." });
    }
    if (!machineId || typeof machineId !== 'string' || !machineId.trim()) {
      return res.status(400).json({ success: false, error: "machineId obligatoire pour vérifier la licence." });
    }

    const cleanKey = key.trim().toUpperCase();
    const cleanMachineId = machineId.trim();
    const serverTime = new Date().toISOString();
    const nowMs = Date.now();

    const licenseRef = db.collection('licenses').doc(cleanKey);
    const docSnap = await licenseRef.get();

    if (!docSnap.exists) {
      return res.status(200).json({ success: true, status: 'revoked', error: "Licence introuvable." });
    }

    const data = docSnap.data() || {};

    if (data.status === 'unused' || !data.status) {
      return res.status(400).json({ success: false, status: 'unused', error: "Cette licence n'a pas encore été activée." });
    }

    if (data.status === 'revoked') {
      return res.status(200).json({ success: true, status: 'revoked', error: "Licence révoquée." });
    }

    if (data.expiresAt && new Date(data.expiresAt).getTime() < nowMs) {
      await licenseRef.update({ status: 'expired', updatedAt: serverTime });
      return res.status(200).json({ success: true, status: 'expired', error: "Licence expirée." });
    }

    if (data.machineId && data.machineId !== cleanMachineId) {
      return res.status(200).json({ success: true, status: 'invalid', error: "Licence liée à un autre PC." });
    }

    const payload = {
      key: cleanKey,
      tenantId: data.tenantId || '',
      machineId: data.machineId || cleanMachineId,
      activatedAt: data.activatedAt || serverTime,
      expiresAt: data.expiresAt || serverTime,
      serverTime
    };

    const token = signPayload(payload, privateKeyBase64);

    return res.status(200).json({
      success: true,
      status: data.status || 'active',
      token,
      serverTime
    });

  } catch (error: any) {
    console.error("Erreur api/check-license:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Erreur lors de la vérification."
    });
  }
}
