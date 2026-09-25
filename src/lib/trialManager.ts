import CryptoJS from 'crypto-js';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Clé secrète embarquée pour signer l'état du trial (à obfusquer en prod)
const TRIAL_SECRET = 'CARISOFT_TRIAL_SECRET_2026';
const TRIAL_DAYS = 5;

interface TrialPayload {
  trialStart: number; // timestamp
  hwid: string;
}

// Fonction utilitaire pour simuler l'accès au filesystem Tauri 
// (En prod, on utiliserait le plugin fs de tauri)
const getTenantTrialKey = (companyId: string) => `carisoft_tenant_${companyId}_trial_blob`;

const readTauriFile = async (companyId: string): Promise<string | null> => {
  if ('__TAURI_INTERNALS__' in window) {
    // try {
    //   const { readTextFile, BaseDirectory } = await import('@tauri-apps/api/fs');
    //   return await readTextFile('trial.dat', { dir: BaseDirectory.AppData });
    // } catch (e) {
    //   return null;
    // }
    return localStorage.getItem(getTenantTrialKey(companyId));
  }
  return localStorage.getItem(getTenantTrialKey(companyId));
};

const writeTauriFile = async (companyId: string, content: string): Promise<void> => {
  if ('__TAURI_INTERNALS__' in window) {
    // try {
    //   const { writeTextFile, BaseDirectory } = await import('@tauri-apps/api/fs');
    //   await writeTextFile('trial.dat', content, { dir: BaseDirectory.AppData });
    // } catch (e) {}
    localStorage.setItem(getTenantTrialKey(companyId), content);
    return;
  }
  localStorage.setItem(getTenantTrialKey(companyId), content);
};

// Récupère l'ID matériel (réutilisation de la logique existante)
const getMachineId = async (): Promise<string> => {
  if ('__TAURI_INTERNALS__' in window) {
    return "TAURI-MACHINE-ID-MOCK";
  }
  let machineId = localStorage.getItem('local_machine_id');
  if (!machineId) {
    machineId = crypto.randomUUID();
    localStorage.setItem('local_machine_id', machineId);
  }
  return machineId;
};

// Signe le payload avec HMAC
const signPayload = (payload: TrialPayload): string => {
  const payloadStr = JSON.stringify(payload);
  const signature = CryptoJS.HmacSHA256(payloadStr, TRIAL_SECRET).toString(CryptoJS.enc.Hex);
  return btoa(`${payloadStr}.${signature}`); // Encodé en base64 pour cacher le JSON clair
};

// Vérifie et extrait le payload
const verifyPayload = (blob: string): TrialPayload | null => {
  try {
    const decoded = atob(blob);
    const [payloadStr, signature] = decoded.split('.');
    
    if (!payloadStr || !signature) return null;

    const expectedSignature = CryptoJS.HmacSHA256(payloadStr, TRIAL_SECRET).toString(CryptoJS.enc.Hex);
    if (signature !== expectedSignature) {
      console.error("Signature Trial invalide (Triche détectée)");
      return null;
    }

    return JSON.parse(payloadStr) as TrialPayload;
  } catch (e) {
    return null;
  }
};

export const initializeTrial = async (companyId: string): Promise<void> => {
  if (!companyId) return;
  try {
    let blob = await readTauriFile(companyId);
    const hwid = await getMachineId();
    let payload: TrialPayload | null = null;

    if (blob) {
      payload = verifyPayload(blob);
    }

    // Si pas de trial existant, on le crée
    if (!payload) {
      const now = Date.now();
      payload = { trialStart: now, hwid };
      blob = signPayload(payload);
      
      await writeTauriFile(companyId, blob);
      localStorage.setItem(`carisoft_tenant_${companyId}_trial_start`, now.toString()); // Redondance légère

      // Enregistrer sur Firestore si on a internet
      if (navigator.onLine) {
        try {
          const functions = getFunctions();
          const registerTrial = httpsCallable(functions, 'registerTrial');
          await registerTrial({ hwid, trialStart: now, companyId });
        } catch (e) {
          console.warn("Impossible d'enregistrer le trial sur le serveur pour le moment (Cloud Function non déployée).");
        }
      }
    }
  } catch (err) {
    console.error("Erreur initialisation trial:", err);
  }
};

export const getRemainingTrialDays = async (companyId: string): Promise<number> => {
  if (!companyId) return 0;
  try {
    const blob = await readTauriFile(companyId);
    if (!blob) return 0; // Pas de trial = bloqué par défaut si pas de licence

    const payload = verifyPayload(blob);
    if (!payload) return 0; // Triche ou fichier corrompu

    const now = Date.now();
    
    // Détection d'horloge reculée (Triche)
    if (now < payload.trialStart) {
      console.warn("Horloge système modifiée (Recul). Trial invalidé.");
      return 0; 
    }

    const elapsedMs = now - payload.trialStart;
    const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
    
    const remaining = Math.ceil(TRIAL_DAYS - elapsedDays);
    return remaining > 0 ? remaining : 0;

  } catch (err) {
    return 0;
  }
};

export const isTrialExpired = async (companyId: string): Promise<boolean> => {
  const days = await getRemainingTrialDays(companyId);
  return days <= 0;
};
