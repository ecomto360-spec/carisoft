import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    const token = authHeader.split('Bearer ')[1];

    const { initFirebaseClients } = await import('./_lib/firebase.js');
    const { db: firestore, auth } = await initFirebaseClients({ withAuth: true });

    if (auth) {
      await auth.verifyIdToken(token);
    }

    const { action, durationDays, tenantId, key } = req.body || {};

    if (action === 'create') {
      const licenseKey = key || `CARI-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const licenseRef = firestore.collection('licenses').doc(licenseKey);
      
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

    const snapshot = await firestore.collection('licenses').get();
    const licenses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return res.status(200).json({ success: true, licenses });
  } catch (error: any) {
    console.error('[admin-licenses] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack || null
    });
  }
}
