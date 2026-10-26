import * as nacl from 'tweetnacl';
import { Buffer } from 'buffer';
import { db } from '../db/db';
import type { LicenseTokenPayload, LicenseStateRecord } from '../types';

// URL de base du backend Vercel pour les appels API (le runtime Tauri n'ayant pas d'origine Vercel)
export const API_BASE = 'https://carisoft.vercel.app';

// Clé publique Ed25519 officielle embarquée dans le frontend uniquement pour la version web (affichage / vérification légère hors-ligne)
export const PUBLIC_KEY_BASE64 = "DlgVvWbyqlQ0R8t0kiHtfxkDGkMfPdkThnle3dyIoP8=";

/**
 * Récupère l'identifiant matériel unique de la machine (SHA-256 du machine-uid en Tauri).
 * - En environnement Tauri : appelle invoke('get_machine_id').
 * - En environnement Web/Navigateur (dev uniquement) : UUID stocké dans localStorage.
 */
export async function getMachineId(): Promise<string> {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const isTauri = Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);

    if (isTauri) {
      const invokeFn = win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.invoke || win.__TAURI__?.core?.invoke;
      if (typeof invokeFn === 'function') {
        try {
          const hwid = await invokeFn('get_machine_id');
          if (hwid && typeof hwid === 'string' && hwid.trim().length > 0) {
            return hwid.trim();
          }
          throw new Error("L'appel get_machine_id a retourné un identifiant vide.");
        } catch (err: any) {
          throw new Error(`Erreur lors de la récupération de l'identifiant machine Tauri : ${err?.message || err}`);
        }
      }
      throw new Error("Environnement Tauri détecté mais la fonction invoke est inaccessible.");
    }

    // Fallback navigateur (développement uniquement)
    let machineId = localStorage.getItem('carisoft_machine_id');
    if (!machineId) {
      machineId = crypto.randomUUID();
      localStorage.setItem('carisoft_machine_id', machineId);
    }
    return machineId;
  }
  return 'offline-default-machine-id';
}

/**
 * Génère une clé de licence au format CARI-XXXX-XXXX-XXXX-XXXX
 * Utilise crypto.getRandomValues et exclut les caractères ambigus (0, O, 1, I).
 */
export function generateLicenseKeyString(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const getBlock = (len: number) => {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let str = '';
    for (let i = 0; i < len; i++) {
      str += chars[arr[i] % chars.length];
    }
    return str;
  };
  return `CARI-${getBlock(4)}-${getBlock(4)}-${getBlock(4)}-${getBlock(4)}`;
}

/**
 * Décode et vérifie un jeton signé Ed25519 pour la version Web.
 */
export function verifyTokenOffline(token: string): { payload: LicenseTokenPayload; signature: string } {
  if (!token || typeof token !== 'string') {
    throw new Error("Jeton de licence manquant ou invalide.");
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new Error("Format du jeton de licence invalide.");
  }

  const [payloadBase64, signatureBase64] = parts;
  const payloadBytes = new Uint8Array(Buffer.from(payloadBase64, 'base64'));
  const signatureBytes = new Uint8Array(Buffer.from(signatureBase64, 'base64'));
  const publicKeyBytes = new Uint8Array(Buffer.from(PUBLIC_KEY_BASE64, 'base64'));

  if (publicKeyBytes.length !== 32) {
    throw new Error("Taille de clé publique Ed25519 invalide (32 octets attendus).");
  }

  const isValid = nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKeyBytes);
  if (!isValid) {
    throw new Error("Signature cryptographique invalide. Licence altérée ou invalide.");
  }

  const payloadJson = Buffer.from(payloadBytes).toString('utf8');
  const payload: LicenseTokenPayload = JSON.parse(payloadJson);

  return { payload, signature: signatureBase64 };
}

export interface LicenseCheckResult {
  valid: boolean;
  status: 'active' | 'expired' | 'revoked' | 'invalid' | 'tampered' | 'none' | 'locked_offline';
  daysRemaining: number;
  message?: string;
  payload?: LicenseTokenPayload;
  days_remaining?: number;
}

/**
 * Active une licence.
 * - Dans Tauri (window.__TAURI__) : appelle uniquement invoke("license_activate", { key, tenantId }).
 *   Ne plus écrire licenseState/settings/localStorage pour la licence.
 * - En mode Web : contacte /api/activate-license et vérifie le token retourné.
 */
export async function activateLicense(
  rawKey: string,
  tenantId: string
): Promise<LicenseTokenPayload & { days_remaining?: number }> {
  if (!rawKey || !rawKey.trim()) {
    throw new Error("Veuillez saisir une clé de licence.");
  }
  if (!tenantId || !tenantId.trim()) {
    throw new Error("Identifiant de l'entreprise (tenantId) manquant.");
  }

  const cleanKey = rawKey.trim().toUpperCase();
  const cleanTenantId = tenantId.trim();

  // Mode TAURI : appel direct et exclusif du backend Rust natif
  if (typeof window !== 'undefined') {
    const win = window as any;
    const isTauri = Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
    if (isTauri) {
      const invokeFn = win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.invoke || win.__TAURI__?.core?.invoke;
      if (typeof invokeFn !== 'function') {
        throw new Error("Environnement Tauri détecté mais la fonction invoke est inaccessible.");
      }
      const rustState = await invokeFn('license_activate', { key: cleanKey, tenantId: cleanTenantId });
      window.dispatchEvent(new CustomEvent('license_activated', { detail: { tenantId: cleanTenantId, companyId: cleanTenantId } }));
      return {
        key: cleanKey,
        tenantId: cleanTenantId,
        machineId: '',
        activatedAt: '',
        expiresAt: rustState?.expires_at || '',
        serverTime: '',
        days_remaining: rustState?.days_remaining
      };
    }
  }

  // Mode WEB : validation via l'API serveur Vercel
  const machineId = await getMachineId();

  if (!navigator.onLine) {
    throw new Error("Une connexion Internet est obligatoire pour l'activation de votre licence.");
  }

  const response = await fetch(`${API_BASE}/api/activate-license`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: cleanKey,
      machineId,
      tenantId: cleanTenantId
    })
  });

  const data = await response.json();

  if (!response.ok || !data.success || !data.token) {
    throw new Error(data.error || "Échec de l'activation de la licence auprès du serveur.");
  }

  const { payload, signature } = verifyTokenOffline(data.token);

  /* Jeton Ed25519 verifie */
  if (payload.machineId !== machineId) {
    throw new Error("Cette licence est verrouillée sur un autre ordinateur.");
  }

  const now = Date.now();
  const stateRecord: LicenseStateRecord = {
    tenantId: cleanTenantId,
    key: cleanKey,
    token: data.token,
    payload,
    signature,
    lastSeenAt: now,
    status: 'active',
    updatedAt: new Date().toISOString()
  };

  await db.licenseState.put(stateRecord);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('license_activated', { detail: { tenantId: cleanTenantId, companyId: cleanTenantId } }));
  }

  const expiryMs = new Date(payload.expiresAt).getTime();
  const days_remaining = !isNaN(expiryMs) && expiryMs > now ? Math.ceil((expiryMs - now) / (1000 * 60 * 60 * 24)) : 0;

  return {
    ...payload,
    days_remaining
  };
}

/**
 * Vérification de l'état de la licence :
 * - Dans Tauri : appelle uniquement invoke("license_status").
 * - En mode Web : lit db.licenseState et effectue la vérification cryptographique.
 */
export async function verifyLicenseOffline(tenantId: string): Promise<LicenseCheckResult> {
  if (!tenantId) {
    return { valid: false, status: 'none', daysRemaining: 0 };
  }

  // Mode TAURI natif : la source de vérité est le module Rust
  if (typeof window !== 'undefined') {
    const win = window as any;
    const isTauri = Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
    if (isTauri) {
      const invokeFn = win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.invoke || win.__TAURI__?.core?.invoke;
      if (typeof invokeFn !== 'function') {
        return {
          valid: false,
          status: 'invalid',
          daysRemaining: 0,
          message: "Environnement Tauri détecté mais la fonction invoke est inaccessible."
        };
      }
      try {
        const rustState = await invokeFn('license_status');
        if (rustState) {
          const rawStatus = rustState.status;
          const valid = rawStatus === 'active';
          const daysRemaining = typeof rustState.days_remaining === 'number' ? rustState.days_remaining : 0;
          const normalizedStatus: LicenseCheckResult['status'] = 
            rawStatus === 'not_found' ? 'none' : rawStatus;

          return {
            valid,
            status: normalizedStatus,
            daysRemaining,
            days_remaining: daysRemaining,
            message: valid ? undefined : `État de licence : ${normalizedStatus}`
          };
        }
        return { valid: false, status: 'none', daysRemaining: 0 };
      } catch (e: any) {
        return {
          valid: false,
          status: 'invalid',
          daysRemaining: 0,
          message: e?.message || "Erreur de communication avec le module de licence natif."
        };
      }
    }
  }

  // Mode WEB : fallback Dexie
  const record = await db.licenseState.get(tenantId);
  if (!record || !record.token) {
    return { valid: false, status: 'none', daysRemaining: 0, message: "Aucune licence enregistrée." };
  }

  let verifiedPayload: LicenseTokenPayload;
  try {
    const verified = verifyTokenOffline(record.token);
    verifiedPayload = verified.payload;
  } catch (err: any) {
    return { valid: false, status: 'invalid', daysRemaining: 0, message: err.message || "Licence invalide." };
  }

  const now = Date.now();
  const expiryTime = new Date(verifiedPayload.expiresAt).getTime();
  if (now >= expiryTime) {
    return {
      valid: false,
      status: 'expired',
      daysRemaining: 0,
      message: "Votre licence a expiré.",
      payload: verifiedPayload
    };
  }

  const remainingMs = expiryTime - now;
  const daysRemaining = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60 * 24)));

  return {
    valid: true,
    status: 'active',
    daysRemaining,
    days_remaining: daysRemaining,
    payload: verifiedPayload
  };
}

/**
 * Lance la vérification continue de la licence :
 * - Au démarrage
 * - Toutes les heures
 */
export function startLicenseWatcher(
  tenantId: string,
  onResult: (res: LicenseCheckResult) => void
): () => void {
  let isSubscribed = true;

  const runCheck = async () => {
    if (!isSubscribed) return;
    try {
      const res = await verifyLicenseOffline(tenantId);
      if (isSubscribed) onResult(res);
    } catch (err) {
      console.error("Erreur vérification licence récurrente:", err);
    }
  };

  runCheck();
  const timer = setInterval(runCheck, 60 * 60 * 1000);

  return () => {
    isSubscribed = false;
    clearInterval(timer);
  };
}

/**
 * Wrappers Tauri complémentaires
 */
export async function getTauriLicenseStatus(): Promise<any> {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const isTauri = Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
    if (isTauri) {
      const invokeFn = win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.invoke || win.__TAURI__?.core?.invoke;
      if (typeof invokeFn === 'function') {
        try {
          return await invokeFn('license_status');
        } catch (e) {
          console.warn("license_status invoke error:", e);
        }
      }
    }
  }
  return null;
}

export async function getTauriLicenseDiagnostics(): Promise<any> {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const isTauri = Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
    if (isTauri) {
      const invokeFn = win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.invoke || win.__TAURI__?.core?.invoke;
      if (typeof invokeFn === 'function') {
        try {
          return await invokeFn('license_diagnostics');
        } catch (e) {}
      }
    }
  }
  return null;
}

export async function resetTauriLicenseAdmin(): Promise<any> {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const isTauri = Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
    if (isTauri) {
      const invokeFn = win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.invoke || win.__TAURI__?.core?.invoke;
      if (typeof invokeFn === 'function') {
        try {
          return await invokeFn('license_admin', { action: 'reset' });
        } catch (e) {}
      }
    }
  }
  return null;
}
