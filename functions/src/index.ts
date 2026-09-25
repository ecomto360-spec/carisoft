import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import * as nacl from 'tweetnacl';

admin.initializeApp();
const db = getFirestore();

// Utilitaire pour encoder/decoder base64
const toBase64 = (arr: Uint8Array) => Buffer.from(arr).toString('base64');
const fromBase64 = (str: string) => Buffer.from(str, 'base64');
const toUtf8 = (str: string) => Buffer.from(str, 'utf8');

/**
 * bindLicense
 * @param key: La clé de licence initiale (générée avec machineId: null)
 * @param machineId: L'ID matériel du poste client
 */
export const bindLicense = functions.https.onCall(async (data: any, context: any) => {
  const { key, machineId } = data;

  if (!key || !machineId) {
    throw new functions.https.HttpsError('invalid-argument', 'key et machineId sont requis.');
  }

  // 1. Lire la clé brute et extraire le payload (format attendu: payloadBase64.signatureBase64)
  const parts = key.split('.');
  if (parts.length !== 2) {
    throw new functions.https.HttpsError('invalid-argument', 'Format de clé invalide.');
  }

  // Optionnel : vérifier la signature initiale ici si nécessaire, mais on vérifie surtout en base
  // Pour la sécurité, on accède au document dans Firestore en utilisant la clé comme ID ou via une requête
  // Comme la clé peut être longue, on peut avoir stoqué le document avec l'ID = key, 
  // ou on peut décoder le payload pour trouver un ID unique. 
  // Supposons que le document est stocké avec l'ID = la clé complète, ou qu'on la cherche.
  const licensesRef = db.collection('licenses');
  const query = await licensesRef.where('licenseKey', '==', key).limit(1).get();

  if (query.empty) {
    throw new functions.https.HttpsError('not-found', 'Licence introuvable.');
  }

  const doc = query.docs[0];
  const licenseData = doc.data();

  // 2. Vérifications de validité
  if (!licenseData.active) {
    throw new functions.https.HttpsError('permission-denied', 'Cette licence a été révoquée ou est inactive.');
  }

  if (new Date(licenseData.expiresAt).getTime() < Date.now()) {
    throw new functions.https.HttpsError('permission-denied', 'Cette licence est expirée.');
  }

  if (licenseData.machineId && licenseData.machineId !== machineId) {
    throw new functions.https.HttpsError('already-exists', 'Cette licence est déjà liée à une autre machine.');
  }

  // 3. Re-signer la clé avec le nouveau machineId
  // Récupérer la clé privée depuis les variables d'environnement (définie via firebase functions:config:set ou Secret Manager)
  const privateKeyBase64 = process.env.LICENSE_PRIVATE_KEY;
  if (!privateKeyBase64) {
    console.error('Clé privée Ed25519 non configurée sur le serveur.');
    throw new functions.https.HttpsError('internal', 'Erreur de configuration serveur.');
  }

  const secretKey = new Uint8Array(fromBase64(privateKeyBase64));

  const newPayload = {
    email: licenseData.email,
    plan: licenseData.plan,
    machineId: machineId,
    expiresAt: licenseData.expiresAt
  };

  const payloadMsg = toUtf8(JSON.stringify(newPayload));
  const signature = nacl.sign.detached(payloadMsg, secretKey);
  
  const newKey = `${toBase64(payloadMsg)}.${toBase64(signature)}`;

  // 4. Mettre à jour Firestore
  await doc.ref.update({
    machineId: machineId,
    boundAt: new Date().toISOString(),
    updatedKey: newKey // Optionnel : stocker la nouvelle clé générée
  });

  // 5. Retourner la nouvelle clé au client
  return { newKey };
});

/**
 * generateLicense (Appelé par le SuperAdmin)
 */
export const generateLicense = functions.https.onCall(async (data: any, context: any) => {
  // Optionnel: vérifier si context.auth.token.role === 'superadmin'
  const { email, durationMonths } = data;
  const privateKeyBase64 = process.env.LICENSE_PRIVATE_KEY;
  if (!privateKeyBase64) throw new functions.https.HttpsError('internal', 'Clé privée manquante.');

  const secretKey = new Uint8Array(fromBase64(privateKeyBase64));
  
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + durationMonths);

  const payload = {
    email,
    plan: "PRO",
    expiresAt: expiresAt.toISOString(),
    machineId: null // Pas de machine ID au départ
  };

  const payloadMsg = toUtf8(JSON.stringify(payload));
  const signature = nacl.sign.detached(payloadMsg, secretKey);
  const licenseKey = `${toBase64(payloadMsg)}.${toBase64(signature)}`;

  // Stocker dans Firestore
  await db.collection('licenses').doc(licenseKey).set({
    email,
    plan: "PRO",
    durationMonths,
    machineId: null,
    boundAt: null,
    expiresAt: expiresAt.toISOString(),
    active: true,
    createdAt: new Date().toISOString(),
    licenseKey
  });

  return { licenseKey };
});

/**
 * registerTrial
 */
export const registerTrial = functions.https.onCall(async (data: any, context: any) => {
  const { hwid, trialStart } = data;
  if (!hwid || !trialStart) throw new functions.https.HttpsError('invalid-argument', 'hwid and trialStart required');

  const trialRef = db.collection('trials').doc(hwid);
  const doc = await trialRef.get();
  
  if (!doc.exists) {
    await trialRef.set({
      hwid,
      trialStart,
      createdAt: new Date().toISOString()
    });
  }
  return { success: true };
});

/**
 * notifySuperAdminNewRequest
 */
export const notifySuperAdminNewRequest = functions.https.onCall(async (data: any, context: any) => {
  const { requestId } = data;
  
  // Implémentation future : Envoyer un email via SendGrid/Nodemailer ou un message WhatsApp via Twilio/Meta API
  console.log(`[NOTIFICATION MOCK] 📧 Email envoyé à: ecomto360@gmail.com pour la demande ID ${requestId}`);
  console.log(`[NOTIFICATION MOCK] 💬 WhatsApp envoyé au: +213554252579 pour la demande ID ${requestId}`);
  
  return { success: true };
});

/**
 * sendLicenseEmail
 */
export const sendLicenseEmail = functions.https.onCall(async (data: any, context: any) => {
  const { email, licenseKey, plan } = data;
  
  // Mock email sending
  console.log(`[EMAIL MOCK] Envoi de la licence ${plan} à ${email}. Clé: ${licenseKey}`);
  
  return { success: true };
});

export * from './onNewActivationRequest';

export const revokeLicense = functions.https.onCall(async (data: any, context: any) => {
  // Optionnel: vérifier superadmin
  const { key } = data;
  const licensesRef = db.collection('licenses');
  const query = await licensesRef.where('licenseKey', '==', key).limit(1).get();
  
  if (!query.empty) {
    await query.docs[0].ref.update({ active: false });
  }
  return { success: true };
});

/**
 * onUserDocumentWrite
 * Updates Custom Claims with companyId when a user document is created or updated
 */
export const onUserDocumentWrite = functions.firestore
  .document('users/{userId}')
  .onWrite(async (change, context) => {
    const userId = context.params.userId;
    const after = change.after.exists ? change.after.data() : null;

    if (after && after.companyId) {
      try {
        await admin.auth().setCustomUserClaims(userId, { 
          companyId: after.companyId,
          role: after.role || 'viewer' 
        });
        console.log(`Custom claims mis à jour pour ${userId} avec companyId: ${after.companyId}`);
      } catch (error) {
        console.error(`Erreur lors de la mise à jour des claims pour ${userId}:`, error);
      }
    }
  });
