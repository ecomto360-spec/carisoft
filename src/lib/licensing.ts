import * as nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../db/db';

// En environnement Tauri, ces appels sont remplacés par des invoke Rust
const getMachineId = async (): Promise<string> => {
  if ('__TAURI_INTERNALS__' in window) {
    // import { invoke } from '@tauri-apps/api/core';
    // return await invoke<string>('get_machine_id');
    return "TAURI-MACHINE-ID-MOCK";
  }
  
  // Web fallback: générer un UUID local dans localStorage
  let machineId = localStorage.getItem('local_machine_id');
  if (!machineId) {
    machineId = crypto.randomUUID();
    localStorage.setItem('local_machine_id', machineId);
  }
  return machineId;
};

// Clé publique générée et partagée avec le backend
// /!\ Cette clé publique correspond à la clé privée stockée sur le serveur
const PUBLIC_KEY_BASE64 = "REPLACE_WITH_YOUR_PUBLIC_KEY_BASE64";

function toUint8Array(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export interface LicensePayload {
  email: string;
  plan: string;
  expiresAt: string;
  machineId: string | null;
}

export const verifyLicenseOffline = (licenseKey: string): LicensePayload => {
  const parts = licenseKey.split('.');
  if (parts.length !== 2) throw new Error("Format de clé invalide");

  const payloadMsg = toUint8Array(parts[0]);
  const signature = toUint8Array(parts[1]);
  const publicKey = toUint8Array(PUBLIC_KEY_BASE64);

  const isValid = nacl.sign.detached.verify(payloadMsg, signature, publicKey);
  
  if (!isValid) {
    throw new Error("Signature cryptographique invalide. Clé contrefaite.");
  }

  const payloadStr = Buffer.from(payloadMsg).toString('utf8');
  return JSON.parse(payloadStr) as LicensePayload;
};

export const activateLicense = async (rawKey: string, companyId: string): Promise<void> => {
  if (!companyId) throw new Error("companyId manquant");
  const payload = verifyLicenseOffline(rawKey);
  
  if (new Date(payload.expiresAt).getTime() < Date.now()) {
    throw new Error("Cette licence est expirée.");
  }

  const machineId = await getMachineId();

  // Si la clé est déjà liée à une machineId
  if (payload.machineId) {
    if (payload.machineId !== machineId) {
      throw new Error("Cette licence est liée à un autre ordinateur.");
    }
    // Si c'est notre machine, c'est bon, on sauvegarde
    localStorage.setItem(`carisoft_tenant_${companyId}_license_key`, rawKey);
    return;
  }

  // La clé est "machineId: null", on doit la lier
  try {
    if (navigator.onLine) {
      // Online: On appelle la Cloud Function pour lier la clé
      const functions = getFunctions();
      const bindLicense = httpsCallable(functions, 'bindLicense');
      const result = await bindLicense({ key: rawKey, machineId });
      
      const newKey = (result.data as any).newKey;
      
      // On sauvegarde la nouvelle clé resignée (avec machineId inclus)
      localStorage.setItem(`carisoft_tenant_${companyId}_license_key`, newKey);
    } else {
      // Offline: On lie localement temporairement
      localStorage.setItem(`carisoft_tenant_${companyId}_license_key`, rawKey);
      localStorage.setItem(`carisoft_tenant_${companyId}_pending_license_sync`, rawKey);
      console.warn("Licence liée localement (Offline). Synchronisation requise à la prochaine connexion.");
    }
  } catch (error: any) {
    console.error("Erreur lors de l'activation:", error);
    if (!navigator.onLine) {
       // Fallback au mode offline si l'appel réseau échoue à cause du réseau
       localStorage.setItem(`carisoft_tenant_${companyId}_license_key`, rawKey);
       localStorage.setItem(`carisoft_tenant_${companyId}_pending_license_sync`, rawKey);
       return;
    }
    throw new Error(error.message || "Impossible d'activer la licence auprès du serveur.");
  }
};

export const syncPendingBinding = async (companyId: string) => {
  if (!companyId) return;
  const pendingKey = localStorage.getItem(`carisoft_tenant_${companyId}_pending_license_sync`);
  if (!pendingKey || !navigator.onLine) return;

  try {
    const machineId = await getMachineId();
    const functions = getFunctions();
    const bindLicense = httpsCallable(functions, 'bindLicense');
    
    const result = await bindLicense({ key: pendingKey, machineId });
    const newKey = (result.data as any).newKey;
    
    localStorage.setItem(`carisoft_tenant_${companyId}_license_key`, newKey);
    localStorage.removeItem(`carisoft_tenant_${companyId}_pending_license_sync`);
    console.log("Synchronisation de la licence réussie.");
  } catch (err) {
    console.error("Échec de la synchronisation de la licence en arrière-plan:", err);
  }
};
