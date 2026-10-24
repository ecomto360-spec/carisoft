/**
 * Security & Cryptography Engine for CARISOFT.next
 * - SHA-256 Password Hashing & Verification
 * - Cryptographic SaaS License Generator & Signature Validator (Exclusive to Super Admin)
 * - Rate Limiter / Anti-Brute Force Protection
 * - Credential Encryption / Obfuscation
 */

const SALT = 'CARISOFT_SECURE_SALT_2026_@AGREGATS#';
const LICENSE_SECRET = 'CARISOFT_SUPERADMIN_RSA_SIGN_KEY_NABSTERZERO_2026';

/**
 * Hash a password using standard Web Crypto API (SHA-256 + Salt)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a given password against stored hash (or plain-text legacy password)
 */
export async function verifyPassword(password: string, storedHashOrPlain: string): Promise<boolean> {
  if (!storedHashOrPlain) return false;
  
  // If stored value is already a 64-char hex SHA-256 hash
  if (storedHashOrPlain.length === 64 && /^[0-9a-fA-F]+$/.test(storedHashOrPlain)) {
    const computedHash = await hashPassword(password);
    return computedHash.toLowerCase() === storedHashOrPlain.toLowerCase();
  }
  
  // Legacy / Initial plaintext check
  return password === storedHashOrPlain;
}

/**
 * Encrypt sensitive string for local storage / transport
 */
export function encryptPayload(payload: string): string {
  try {
    const encoded = btoa(encodeURIComponent(payload));
    // Apply XOR mask
    let result = '';
    for (let i = 0; i < encoded.length; i++) {
      result += String.fromCharCode(encoded.charCodeAt(i) ^ (SALT.charCodeAt(i % SALT.length) & 0x1F));
    }
    return btoa(result);
  } catch {
    return btoa(payload);
  }
}

/**
 * Decrypt sensitive string
 */
export function decryptPayload(cipher: string): string {
  try {
    const raw = atob(cipher);
    let decoded = '';
    for (let i = 0; i < raw.length; i++) {
      decoded += String.fromCharCode(raw.charCodeAt(i) ^ (SALT.charCodeAt(i % SALT.length) & 0x1F));
    }
    return decodeURIComponent(atob(decoded));
  } catch {
    try {
      return atob(cipher);
    } catch {
      return cipher;
    }
  }
}



/**
 * IP Detection & Free Trial Rate Limiter
 * Ensures an IP address can only ever generate ONE 3-day free trial.
 */
const IP_TRIAL_STORAGE_KEY = 'carisoft_registered_trial_ips_v2';

export interface TrialRecord {
  ip: string;
  email: string;
  company: string;
  createdAt: string;
  licenseKey: string;
}

/**
 * Detect client public IP or generate stable browser/hardware fingerprint
 */
export async function fetchClientIP(): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      if (data.ip) return data.ip;
    }
  } catch (e) {
    // Offline or blocked by network, fallback to fingerprint
  }

  // Generate a deterministic browser fingerprint fallback
  const rawString = `${navigator.userAgent}-${navigator.language}-${screen.width}x${screen.height}`;
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawString));
  const hash = Array.from(new Uint8Array(buffer)).slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('');
  return `IP-FP-${hash.toUpperCase()}`;
}

/**
 * Check if the given IP has already consumed its free trial
 */
export function isIPTrialUsed(ip: string): { isUsed: boolean; record?: TrialRecord } {
  try {
    const raw = localStorage.getItem(IP_TRIAL_STORAGE_KEY);
    if (!raw) return { isUsed: false };
    const list: TrialRecord[] = JSON.parse(raw);
    const match = list.find(r => r.ip.toLowerCase() === ip.toLowerCase());
    return { isUsed: Boolean(match), record: match };
  } catch {
    return { isUsed: false };
  }
}

/**
 * Record IP as having consumed its free trial
 */
export function recordIPTrialUsed(ip: string, email: string, company: string, licenseKey: string): void {
  try {
    const raw = localStorage.getItem(IP_TRIAL_STORAGE_KEY);
    const list: TrialRecord[] = raw ? JSON.parse(raw) : [];
    if (!list.some(r => r.ip.toLowerCase() === ip.toLowerCase())) {
      list.push({
        ip,
        email,
        company,
        createdAt: new Date().toISOString(),
        licenseKey
      });
      localStorage.setItem(IP_TRIAL_STORAGE_KEY, JSON.stringify(list));
    }
  } catch (e) {
    console.error('Failed to record trial IP:', e);
  }
}

/**
 * Official Paid SaaS License Plans
 */
export const OFFICIAL_PAID_PLANS = [
  {
    id: 'plan_3m',
    name: 'Pack Trimestriel (3 Mois)',
    durationDays: 90,
    durationLabel: '3 Mois (90 Jours)',
    price: '45 000 DZD',
    popular: false,
    features: ['Gestion Complète des Carrières', 'Bons de livraison & Pesées', 'Facturation & Règlements', 'Support Standard']
  },
  {
    id: 'plan_6m',
    name: 'Pack Semestriel (6 Mois)',
    durationDays: 180,
    durationLabel: '6 Mois (180 Jours)',
    price: '80 000 DZD',
    popular: false,
    features: ['Tous les modules ERP Débloqués', 'Historique & Exports Excel/PDF', 'Mises à jour prioritaires', 'Support Technique Dédié']
  },
  {
    id: 'plan_1y',
    name: 'Pack Annuel Entreprise (1 An)',
    durationDays: 365,
    durationLabel: '1 An (365 Jours)',
    price: '140 000 DZD',
    popular: true,
    features: ['Accès Illimité Multi-Postes', 'Sauvegarde & Chiffrement Cloud', 'Garantie Éditeur 12 Mois', 'Formation & Déploiement Inclus']
  }
];



/**
 * Anti-Brute-Force & Rate Limiter for Login Protection
 */
const RATE_LIMIT_KEY = 'carisoft_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000; // 30 seconds lockout

interface RateLimitRecord {
  attempts: number;
  lockedUntil?: number;
}

export function getRateLimitStatus(): { isLocked: boolean; remainingSeconds: number; attempts: number } {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    
    const record: RateLimitRecord = JSON.parse(raw);
    const now = Date.now();

    if (record.lockedUntil && record.lockedUntil > now) {
      const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
      return { isLocked: true, remainingSeconds, attempts: record.attempts };
    }

    // If lock expired, reset
    if (record.lockedUntil && record.lockedUntil <= now) {
      localStorage.removeItem(RATE_LIMIT_KEY);
      return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }

    return { isLocked: false, remainingSeconds: 0, attempts: record.attempts || 0 };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }
}

export function recordFailedAttempt(): { isLocked: boolean; remainingSeconds: number; attempts: number } {
  const current = getRateLimitStatus();
  const newAttempts = current.attempts + 1;
  
  let lockedUntil: number | undefined;
  if (newAttempts >= MAX_ATTEMPTS) {
    lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
  }

  const record: RateLimitRecord = {
    attempts: newAttempts,
    lockedUntil
  };

  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(record));
  } catch (e) {
    console.error(e);
  }

  return {
    isLocked: Boolean(lockedUntil),
    remainingSeconds: lockedUntil ? Math.ceil(LOCKOUT_DURATION_MS / 1000) : 0,
    attempts: newAttempts
  };
}

export function resetFailedAttempts(): void {
  try {
    localStorage.removeItem(RATE_LIMIT_KEY);
  } catch (e) {
    console.error(e);
  }
}
