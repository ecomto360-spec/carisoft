import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { key, machineId } = req.body || {};
    if (!key || !machineId) {
      return res.status(400).json({ error: 'Key and machineId are required' });
    }

    const { db } = await import('./_lib/firebase.js');
    const { db: firestore } = await db({ withAuth: false });

    const licenseRef = firestore.collection('licenses').doc(key);
    const doc = await licenseRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'License not found' });
    }

    const data = doc.data()!;
    if (data.status === 'activated' && data.machineId !== machineId) {
      return res.status(400).json({ error: 'License already used on another machine' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + (data.durationDays || 30) * 24 * 60 * 60 * 1000).toISOString();

    await licenseRef.update({
      status: 'activated',
      machineId: machineId,
      activatedAt: now.toISOString(),
      expiresAt: expiresAt
    });

    return res.status(200).json({ success: true, message: 'License activated successfully', expiresAt });
  } catch (error: any) {
    console.error('[activate-license] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack || null
    });
  }
}
