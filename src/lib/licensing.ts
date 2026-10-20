// src/lib/licensing.ts
// Couche fine de communication avec le module Rust de licence

let invokeFn: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let isTauriInitialized = false;

async function getInvoke() {
  if (isTauriInitialized) return invokeFn;
  
  try {
    const tauriApi = await import('@tauri-apps/api/tauri');
    if (tauriApi && typeof tauriApi.invoke === 'function') {
      invokeFn = tauriApi.invoke;
      console.log('[License] ✅ API Tauri chargée avec succès');
    }
  } catch (e) {
    console.log('[License] 🌐 Mode Web détecté (Tauri API non disponible)');
  }
  
  isTauriInitialized = true;
  return invokeFn;
}

export interface LicenseCheckResult {
  valid: boolean;
  status: 'active' | 'expired' | 'revoked' | 'invalid' | 'tampered' | 'online_required' | 'none';
  daysRemaining: number;
  expiresAt: number | null;
  message: string;
}

/**
 * Génère une clé de licence au format CARI-XXXX-XXXX-XXXX-XXXX
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

export async function activateLicense(key: string, tenantId: string): Promise<LicenseCheckResult> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      const result = await invoke<LicenseCheckResult>('license_activate', { key, tenantId });
      return result;
    } catch (error: any) {
      return {
        valid: false,
        status: 'invalid',
        daysRemaining: 0,
        expiresAt: null,
        message: `Erreur d'activation: ${error.message || String(error)}`,
      };
    }
  }
  
  return { valid: false, status: 'none', daysRemaining: 0, expiresAt: null, message: "Mode Tauri requis pour l'activation." };
}

export async function verifyLicenseOffline(tenantId: string): Promise<LicenseCheckResult> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      const result = await invoke<LicenseCheckResult>('license_status', { tenantId });
      return result;
    } catch (error: any) {
      return {
        valid: false,
        status: 'invalid',
        daysRemaining: 0,
        expiresAt: null,
        message: `Erreur vérification: ${error.message || String(error)}`,
      };
    }
  }
  
  return { valid: true, status: 'active', daysRemaining: 90, expiresAt: null, message: 'Mode développement web' };
}

export async function getLicenseDiagnostics(): Promise<any> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      return await invoke('license_diagnostics');
    } catch (error: any) {
      return { environnement: 'web', message: `Diagnostics non disponibles: ${error.message}` };
    }
  }
  return { environnement: 'web', message: 'Mode navigateur' };
}

export async function callLicenseAdmin(action: string, idToken: string, params: any): Promise<any> {
  const invoke = await getInvoke();
  if (invoke) {
    try {
      return await invoke('license_admin', { action, idToken, params });
    } catch (error: any) {
      throw new Error(`Erreur admin: ${error.message || String(error)}`);
    }
  }
  throw new Error("Fonction admin uniquement disponible en mode Tauri");
}

export function startLicenseWatcher(
  tenantId: string,
  onStatusChange: (status: LicenseCheckResult) => void
) {
  const check = async () => {
    try {
      const status = await verifyLicenseOffline(tenantId);
      onStatusChange(status);
    } catch (e) {
      console.error("[License] Erreur watcher:", e);
    }
  };
  
  check();
  const intervalId = setInterval(check, 3600000);
  
  return () => clearInterval(intervalId);
}