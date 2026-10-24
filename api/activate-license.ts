import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = getFirestore();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { key, machineId } = req.body;
    if (!key || !machineId) {
      return res.status(400).json({ error: 'Key and machineId are required' });
    }

    const licenseRef = db.collection('licenses').doc(key);
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
    console.error('Error in activate-license:', error);
    return res.status(500).json({ error: error.message });
  }
}
