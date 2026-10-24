import type { VercelRequest, VercelResponse } from '@vercel/node';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps || admin.apps.length === 0) {
  let serviceAccount: any = {};
  try {
    const rawEnv = process.env.FIREBASE_SERVICE_ACCOUNT || '{}';
    serviceAccount = JSON.parse(rawEnv);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e);
  }
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const authAppName = 'auth';
let authApp = admin.apps.find(app => app?.name === authAppName);
if (!authApp) {
  authApp = admin.initializeApp({
    projectId: process.env.AUTH_PROJECT_ID || 'googly-keep-3n96h'
  }, authAppName);
}

const db = getFirestore();
const auth = admin.auth(authApp);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    await auth.verifyIdToken(token);
    
    const { action, durationDays, tenantId, key } = req.body;

    if (action === 'create') {
      const licenseKey = key || `CARI-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const licenseRef = db.collection('licenses').doc(licenseKey);
      
      await licenseRef.set({
        status: 'unused',
        machineId: '',
        activatedAt: '',
        expiresAt: '',
        durationDays: durationDays || 30,
        tenantId: tenantId || 'default',
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({ success: true, key: licenseKey });
    }

    const snapshot = await db.collection('licenses').get();
    const licenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ success: true, licenses });
  } catch (error: any) {
    console.error('Error in admin-licenses:', error);
    return res.status(500).json({ error: error.message });
  }
}
