import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";

// Initialisation de Firebase Admin (s'assure qu'il n'est pas initialisé deux fois)
if (!admin.apps.length) {
  admin.initializeApp();
}

// Configuration du transporteur d'email
// Utilise les variables d'environnement définies via firebase functions:config:set
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: functions.config().smtp?.email || 'ecomto360@gmail.com',
    pass: functions.config().smtp?.password || 'VOTRE_APP_PASSWORD',
  },
});

const ADMIN_EMAIL = "ecomto360@gmail.com";
const ADMIN_WHATSAPP = "213554252579";

export const onNewActivationRequest = functions.firestore
  .document('activationRequests/{requestId}')
  .onCreate(async (snap, context) => {
    const requestData = snap.data();
    const requestId = context.params.requestId;

    const { nom, telephone, email, wilaya, commune, hwid, plan } = requestData;

    // 1. Formatage du numéro de téléphone du client pour WhatsApp
    // Supposons que le format local "0554..." devient "213554..."
    let formattedClientPhone = telephone || "";
    formattedClientPhone = formattedClientPhone.replace(/\s+/g, ''); // Enlever les espaces
    if (formattedClientPhone.startsWith("0")) {
      formattedClientPhone = "213" + formattedClientPhone.substring(1);
    } else if (formattedClientPhone.startsWith("+")) {
      formattedClientPhone = formattedClientPhone.substring(1); // Enlever le '+'
    }

    // 2. Préparation des messages WhatsApp pré-remplis (encodés)
    const waMessageToClient = `Bonjour ${nom}, nous avons bien reçu votre demande d'activation pour CARISOFT.next.`;
    const waLinkToClient = `https://wa.me/${formattedClientPhone}?text=${encodeURIComponent(waMessageToClient)}`;
    
    // (Optionnel) Lien WhatsApp admin pré-rempli avec les infos
    const waMessageAdmin = `Nouvelle demande Carisoft:\nNom: ${nom}\nWilaya: ${wilaya}\nTel: ${telephone}`;
    const waLinkToAdmin = `https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(waMessageAdmin)}`;

    // 3. Préparation de l'email
    const mailOptions = {
      from: `"CARISOFT.next Système" <${functions.config().smtp?.email || 'ecomto360@gmail.com'}>`,
      to: ADMIN_EMAIL,
      subject: `🚨 Nouvelle demande d'activation - ${nom || 'Client'}`,
      html: `
        <div style="font-family: sans-serif; max-w-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1e293b; color: white; padding: 20px; text-align: center;">
            <h2 style="margin: 0;">Nouvelle Demande de Licence</h2>
          </div>
          <div style="padding: 20px; background-color: #f8fafc;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Entreprise/Nom :</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${nom || 'N/A'}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Téléphone :</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${telephone || 'N/A'}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Email :</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${email || 'N/A'}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Localisation :</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${commune}, ${wilaya}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Plan demandé :</strong></td> <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${plan || 'PRO'}</td></tr>
              <tr><td style="padding: 8px 0;"><strong>HWID (Machine) :</strong></td> <td style="padding: 8px 0;"><code style="background: #e2e8f0; padding: 2px 4px; border-radius: 4px; font-size: 12px;">${hwid}</code></td></tr>
            </table>
          </div>
          <div style="padding: 20px; text-align: center; background-color: white;">
            <p style="margin-bottom: 15px; color: #64748b; font-size: 14px;">Contactez le client en un clic :</p>
            <a href="${waLinkToClient}" style="display: inline-block; padding: 12px 24px; background-color: #25D366; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-bottom: 10px;">
              💬 Discuter avec le client sur WhatsApp
            </a>
            <br/>
            <a href="${waLinkToAdmin}" style="display: inline-block; padding: 8px 16px; background-color: #f1f5f9; color: #475569; text-decoration: none; border-radius: 6px; font-size: 14px; margin-top: 10px;">
              Transférer le résumé WhatsApp
            </a>
          </div>
        </div>
      `
    };

    try {
      // 4. Envoi de l'email
      await mailTransport.sendMail(mailOptions);
      console.log(`[SUCCÈS] Email envoyé pour la demande ${requestId}`);
      
      // 5. Mise à jour du document Firestore
      return snap.ref.update({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        emailError: null
      });
    } catch (error: any) {
      console.error(`[ERREUR] Échec de l'envoi d'email pour ${requestId}:`, error);
      
      // Mise à jour du document avec l'erreur
      return snap.ref.update({
        emailSent: false,
        emailError: error.message || "Erreur SMTP inconnue"
      });
    }
  });
