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
    if (!key) {
      return res.status(400).json({ error: 'Key is required' });
    }

    const licenseRef = db.collection('licenses').doc(key);
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
    console.error('Error in check-license:', error);
    return res.status(500).json({ error: error.message });
  }
}
