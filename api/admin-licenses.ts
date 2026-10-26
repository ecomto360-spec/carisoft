import { initializeApp, cert, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { Buffer } from 'buffer';

const ALLOWED_ORIGINS = [
  'https://carisoft.vercel.app',
  'https://tauri.localhost',
  'http://tauri.localhost',
  'tauri://localhost',
  'http://localhost:5173',
  'http://localhost:3000'
];

function setCors(req: any, res: any) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT manquante.');
  const parsed = JSON.parse(raw);
  const projectId = parsed.project_id || 'carisoft-licences';
  const apps = getApps();
  const app = apps.length ? (apps.find(a => a.name === '[DEFAULT]') || getApp())
    : initializeApp({ credential: cert(parsed) });
  return { app, projectId };
}

let certCache: { certs: Record<string, string>; exp: number } | null = null;
async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certCache && certCache.exp > Date.now()) return certCache.certs;
  const url = 'https://www.googleapis.com/robot/v1/metadata/x509/' +
    'securetoken@system.gserviceaccount.com';
  const r = await fetch(url);
  if (!r.ok) throw new Error('Erreur certificats Google: ' + r.status);
  const certs = (await r.json()) as Record<string, string>;
  certCache = { certs, exp: Date.now() + 1800000 };
  return certs;
}

async function verifyIdToken(token: string, projectId: string) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Format JWT invalide.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Alg JWT invalide.');
  let certs = await getGoogleCerts();
  if (!certs[header.kid]) { certCache = null; certs = await getGoogleCerts(); }
  const pem = certs[header.kid];
  if (!pem) throw new Error('Cle publique Google introuvable.');
  const v = crypto.createVerify('RSA-SHA256');
  v.update(parts[0] + '.' + parts[1]);
  v.end();
  if (!v.verify(pem, Buffer.from(parts[2], 'base64url'))) {
    throw new Error('Signature JWT invalide.');
  }
  const allowedProj = new Set([projectId, process.env.AUTH_PROJECT_ID, 'carisoft-licences']);
  if (!allowedProj.has(payload.aud)) throw new Error('Projet JWT non autorise: ' + payload.aud);
  if (payload.exp < Math.floor(Date.now() / 1000) - 60) throw new Error('Jeton expire.');
  return payload;
}

function makeKey(): string {
  const c = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const blk = () => {
    const b = crypto.randomBytes(4);
    return [0,1,2,3].map(i => c[b[i] % c.length]).join('');
  };
  return `CARI-${blk()}-${blk()}-${blk()}-${blk()}`;
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'POST requis' });
  try {
    const { app, projectId } = initAdmin();
    const db = getFirestore(app);
    const body = req.body || {};

    if (body.action === 'submit_request') {
      const nowIso = new Date().toISOString();
      const docRef = await db.collection('activationRequests').add({
        nom: String(body.nom || '').trim(),
        telephone: String(body.telephone || '').trim(),
        email: String(body.email || '').trim(),
        wilaya: String(body.wilaya || '').trim(),
        commune: String(body.commune || '').trim(),
        plan: String(body.plan || 'PRO').trim(),
        hwid: String(body.hwid || '').trim(),
        source: String(body.source || '').trim(),
        status: 'pending',
        createdAt: nowIso,
        dateCreated: nowIso
      });
      return res.status(200).json({ success: true, id: docRef.id });
    }

    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Jeton manquant.' });
    }
    const decoded = await verifyIdToken(authHeader.slice(7).trim(), projectId);
    const extra = (process.env.SUPERADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase());
    const admins = new Set(['nabsterzero@gmail.com', 'superadmin-console@carisoft.com', ...extra]);
    const uEmail = (decoded.email || '').toLowerCase();
    if (!admins.has(uEmail) && decoded.admin !== true && decoded.role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Acces refuse pour ' + uEmail });
    }

    const { action, key, durationDays = 30, tenantId = '', maxMachines = 1, extendDays = 30 } = body;
    if (action === 'list_requests') {
      const snap = await db.collection('activationRequests').get();
      return res.status(200).json({ success: true, requests: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
    }
    if (action === 'create') {
      let gen = '', exists = true, n = 0;
      while (exists && n++ < 10) {
        gen = makeKey();
        exists = (await db.collection('licenses').doc(gen).get()).exists;
      }
      const data = {
        tenantId: String(tenantId).trim(),
        durationDays: Number(durationDays) || 30,
        maxMachines: Number(maxMachines) || 1,
        status: 'unused',
        machineId: '',
        activatedAt: '',
        expiresAt: '',
        createdAt: new Date().toISOString(),
        createdBy: uEmail || 'superadmin'
      };
      await db.collection('licenses').doc(gen).set(data);
      return res.status(200).json({ success: true, key: gen, license: data, ...data });
    }
    if (action === 'list') {
      const snap = await db.collection('licenses').get();
      const licenses = snap.docs.map(d => ({ key: d.id, id: d.id, ...d.data() }));
      return res.status(200).json({ success: true, licenses });
    }
    if (action === 'revoke') {
      const ref = db.collection('licenses').doc(String(key).trim().toUpperCase());
      const nowIso = new Date().toISOString();
      await ref.update({ status: 'revoked', revokedAt: nowIso, updatedAt: nowIso });
      return res.status(200).json({ success: true });
    }
    if (action === 'extend') {
      const ref = db.collection('licenses').doc(String(key).trim().toUpperCase());
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ success: false, error: 'Introuvable' });
      const d = snap.data() || {};
      const add = Number(extendDays) || 30;
      const nowIso = new Date().toISOString();
      if (d.status === 'unused' || !d.expiresAt) {
        await ref.update({ durationDays: (Number(d.durationDays) || 30) + add, updatedAt: nowIso });
        return res.status(200).json({ success: true });
      }
      let base = new Date(d.expiresAt);
      if (isNaN(base.getTime()) || base.getTime() < Date.now()) base = new Date();
      const nextExp = new Date(base.getTime() + add * 86400000).toISOString();
      await ref.update({ expiresAt: nextExp, status: 'active', updatedAt: nowIso });
      return res.status(200).json({ success: true, expiresAt: nextExp, license: { ...d, expiresAt: nextExp } });
    }
    if (action === 'delete') {
      await db.collection('licenses').doc(String(key).trim().toUpperCase()).delete();
      return res.status(200).json({ success: true });
    }
    return res.status(400).json({ success: false, error: 'Action inconnue' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Erreur serveur', stack: err?.stack });
  }
}