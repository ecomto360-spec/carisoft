import { create } from 'zustand';

export interface AppNotification {
  id: string;
  type: 'order' | 'delivery' | 'invoice' | 'system';
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  amount?: number;
  link?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  soundEnabled: boolean;
  activeToast: AppNotification | null;
  addNotification: (payload: {
    type?: 'order' | 'delivery' | 'invoice' | 'system';
    title: string;
    message: string;
    orderId?: string;
    orderNumber?: string;
    customerName?: string;
    amount?: number;
    link?: string;
  }) => void;
  notifyNewOrder: (order: {
    id: string;
    number: string;
    customerName?: string;
    amount: number;
  }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  toggleSound: () => void;
  dismissToast: () => void;
}

const STORAGE_KEY = 'carisoft_notifications_data';
const SOUND_KEY = 'carisoft_notification_sound_enabled';

// Pleasant Web Audio crystal dual-chime synthesizer (0 dependencies, works offline)
export function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Note 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Note 2: A5 (880.00 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.22, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.65);
  } catch (err) {
    console.warn('Audio notification sound was not allowed to play', err);
  }
}

const loadSavedNotifications = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load notifications from localStorage', e);
  }
  return [];
};

const loadSavedSound = (): boolean => {
  try {
    const raw = localStorage.getItem(SOUND_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
};

const initialNotifications = loadSavedNotifications();
const initialSound = loadSavedSound();

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: initialNotifications,
  unreadCount: initialNotifications.filter((n) => !n.read).length,
  soundEnabled: initialSound,
  activeToast: null,

  addNotification: (payload) => {
    const newNotif: AppNotification = {
      id: crypto.randomUUID(),
      type: payload.type || 'order',
      title: payload.title,
      message: payload.message,
      timestamp: new Date().toISOString(),
      read: false,
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      customerName: payload.customerName,
      amount: payload.amount,
      link: payload.link || (payload.orderId ? `/orders` : undefined),
    };

    // Play sound if enabled
    if (get().soundEnabled) {
      playNotificationSound();
    }

    set((state) => {
      // Keep maximum 40 notifications in history
      const updated = [newNotif, ...state.notifications].slice(0, 40);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist notifications', e);
      }
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
        activeToast: newNotif,
      };
    });
  },

  notifyNewOrder: (order) => {
    const formattedAmount = Number(order.amount || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const clientText = order.customerName ? `Client : ${order.customerName}` : 'Nouveau client';

    get().addNotification({
      type: 'order',
      title: `Nouvelle Commande #${order.number}`,
      message: `${clientText} • Total : ${formattedAmount} DZD`,
      orderId: order.id,
      orderNumber: order.number,
      customerName: order.customerName,
      amount: order.amount,
      link: '/orders',
    });
  },

  markAsRead: (id: string) => {
    set((state) => {
      const updated = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update notifications in storage', e);
      }
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
      };
    });
  },

  markAllAsRead: () => {
    set((state) => {
      const updated = state.notifications.map((n) => ({ ...n, read: true }));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save read status in storage', e);
      }
      return {
        notifications: updated,
        unreadCount: 0,
      };
    });
  },

  removeNotification: (id: string) => {
    set((state) => {
      const updated = state.notifications.filter((n) => n.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to delete notification', e);
      }
      return {
        notifications: updated,
        unreadCount: updated.filter((n) => !n.read).length,
        activeToast: state.activeToast?.id === id ? null : state.activeToast,
      };
    });
  },

  clearAll: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear notifications', e);
    }
    set({
      notifications: [],
      unreadCount: 0,
      activeToast: null,
    });
  },

  toggleSound: () => {
    set((state) => {
      const nextVal = !state.soundEnabled;
      try {
        localStorage.setItem(SOUND_KEY, String(nextVal));
      } catch (e) {
        console.warn('Failed to save sound state', e);
      }
      if (nextVal) {
        playNotificationSound();
      }
      return { soundEnabled: nextVal };
    });
  },

  dismissToast: () => {
    set({ activeToast: null });
  },
}));
