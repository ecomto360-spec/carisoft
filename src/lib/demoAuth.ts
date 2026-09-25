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
      localStorage.getItem(DEMO_SESSION_KEY) === 'true' ||
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
 * Perform instant 1-click login into Demo Environment
 * without requiring any password or email entry.
 */
export async function launchDemoSession(): Promise<User> {
  // 1. Ensure basic database seed and settings exist
  await ensureDefaultUsersAndSettings();
  await initDemoData();

  // 2. Ensure company exists or retrieve current company
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

  // 3. Put into local indexedDB users table
  try {
    await db.users.put(demoUser);
  } catch (e) {
    console.warn('Could not persist demo user in db.users', e);
  }

  // 4. Mark demo session flags
  try {
    sessionStorage.setItem(DEMO_SESSION_KEY, 'true');
    localStorage.setItem(DEMO_SESSION_KEY, 'true');
  } catch (e) {
    console.warn('Could not write demo session storage', e);
  }

  // 5. Authenticate user in store
  useAuthStore.getState().login(demoUser);

  return demoUser;
}
