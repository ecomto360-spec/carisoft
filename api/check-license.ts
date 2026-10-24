import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { key, machineId } = req.body || {};
    if (!key) return res.status(400).json({ error: 'Key is required' });

    const { initFirebaseClients } = await import('./_lib/firebase.js');
    const { db: firestore } = await initFirebaseClients({ withAuth: false });

    const licenseRef = firestore.collection('licenses').doc(key);
    const doc = await licenseRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'License not found' });
    }

    const data = doc.data()!;
    if (data.status === 'unused') {
      return res.status(200).json({ status: 'unused', message: "N'a pas encore été activée" });
    }

    if (machineId && data.machineId && data.machineId !== machineId) {
      return res.status(400).json({ error: 'Machine ID mismatch' });
    }

    return res.status(200).json({ success: true, status: data.status, expiresAt: data.expiresAt });
  } catch (error: any) {
    console.error('[check-license] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack || null
    });
  }
}
