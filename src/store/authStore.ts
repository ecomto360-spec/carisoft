import { create } from 'zustand';
import type { User } from '../types';
import { encryptPayload, decryptPayload } from '../lib/security';
import { setDbTenantId } from '../db/db';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updatedData: Partial<User>) => void;
}

const STORAGE_KEY = 'carisoft_auth_sec_session';

const getInitialUser = (): User | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const decrypted = decryptPayload(raw);
      const user = JSON.parse(decrypted);
      delete user.password;
      if (user.companyId) setDbTenantId(user.companyId);
      return user;
    }
  } catch (e) {
    console.error('Failed to restore secure user session', e);
  }
  return null;
};

const initialUser = getInitialUser();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  isAuthenticated: initialUser !== null,
  isSuperAdmin: initialUser?.role === 'superadmin' || initialUser?.email === 'nabsterzero@gmail.com' || initialUser?.username === 'nabsterzero',
  login: (rawUser: User) => {
    // Strip sensitive raw password before storing session
    const safeUser: User = { ...rawUser };
    delete safeUser.password;
    if (safeUser.companyId) setDbTenantId(safeUser.companyId);
    try {
      const encrypted = encryptPayload(JSON.stringify(safeUser));
      localStorage.setItem(STORAGE_KEY, encrypted);
    } catch (e) {
      console.error('Failed to encrypt session', e);
    }

    set({ 
      user: safeUser, 
      isAuthenticated: true, 
      isSuperAdmin: safeUser.role === 'superadmin' || safeUser.email === 'nabsterzero@gmail.com' || safeUser.username === 'nabsterzero' 
    });
  },
  logout: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('carisoft_auth_user'); // legacy cleanup
    } catch (e) {
      console.error(e);
    }
    setDbTenantId(undefined);
    set({ user: null, isAuthenticated: false, isSuperAdmin: false });
  },
  updateUser: (updatedData: Partial<User>) => {
    set((state) => {
      if (!state.user) return state;
      const newUser = { ...state.user, ...updatedData };
      delete newUser.password;
      if (newUser.companyId) setDbTenantId(newUser.companyId);
      try {
        const encrypted = encryptPayload(JSON.stringify(newUser));
        localStorage.setItem(STORAGE_KEY, encrypted);
      } catch (e) {
        console.error(e);
      }
      return { 
        user: newUser, 
        isSuperAdmin: newUser.role === 'superadmin' || newUser.email === 'nabsterzero@gmail.com' || newUser.username === 'nabsterzero' 
      };
    });
  }
}));
