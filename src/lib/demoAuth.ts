import { db, initDemoData, ensureDefaultUsersAndSettings } from '../db/db';
import { useAuthStore } from '../store/authStore';
import type { User } from '../types';

export const DEMO_CLIENT_USER: User = {
  id: 'U-DEMO-TESTER',
  name: 'Client Testeur (Mode Démo)',
  username: 'demo_client',
  email: 'client-demo@carisoft.com',
  role: 'admin',
  companyId: 'comp-demo-sidar-01',
  active: true,
  createdAt: new Date().toISOString(),
};

export const DEMO_SESSION_KEY = 'carisoft_demo_session_active';

export function isDemoSession(): boolean {
  try {
    return (
      sessionStorage.getItem(DEMO_SESSION_KEY) === 'true' ||
      useAuthStore.getState().user?.id === DEMO_CLIENT_USER.id ||
      useAuthStore.getState().user?.username === DEMO_CLIENT_USER.username
    );
  } catch {
    return false;
  }
}

export function getShareableDemoUrl(): string {
  try {
    const origin = window.location.origin;
    return `${origin}/demo`;
  } catch {
    return '/demo';
  }
}

/**
 * Lancement d'une session de démonstration.
 * SÉCURITÉ : Le mode démo ne débloque jamais l'application Tauri (build release).
 * En Tauri, le seul critère d'accès est invoke('license_status').status === 'active'.
 * Aucune fausse clé de licence n'est écrite dans localStorage ou dans la base de données.
 */
export async function launchDemoSession(): Promise<User> {
  // 1. Initialiser le jeu de données démo local
  await ensureDefaultUsersAndSettings();
  await initDemoData();

  // 2. Déterminer l'entreprise démo
  let targetCompanyId = 'comp-demo-sidar-01';
  try {
    const settings = await db.settings.get(1);
    if (settings && (settings as any).companyId) {
      targetCompanyId = (settings as any).companyId;
    }
  } catch (e) {
    console.warn('Could not read settings for demo company', e);
  }

  const demoUser: User = {
    ...DEMO_CLIENT_USER,
    companyId: targetCompanyId,
  };

  // 3. Persister l'utilisateur démo dans la table IndexedDB locale
  try {
    await db.users.put(demoUser);
  } catch (e) {
    console.warn('Could not persist demo user in db.users', e);
  }

  // 4. Marquer le flag de session démo uniquement en sessionStorage volatil (sans toucher à localStorage pour la licence)
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, 'true');
  } catch (e) {
    console.warn('Could not write demo session storage', e);
  }

  // 5. Connecter l'utilisateur dans le store d'authentification
  useAuthStore.getState().login(demoUser);

  return demoUser;
}
