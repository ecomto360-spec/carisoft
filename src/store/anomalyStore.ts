import { create } from 'zustand';

export interface AnomalyReport {
  id: string;
  title: string;
  description: string;
  module: string;
  severity: 'bloquant' | 'moyen' | 'mineur' | 'suggestion';
  type: 'bug' | 'calcul' | 'affichage' | 'suggestion' | 'autre';
  reporterName?: string;
  reporterContact?: string;
  currentUrl?: string;
  systemInfo?: string;
  createdAt: string;
  status: 'nouveau' | 'en_cours' | 'resolu';
  resolutionNotes?: string;
}

interface AnomalyState {
  anomalies: AnomalyReport[];
  isReportModalOpen: boolean;
  isListModalOpen: boolean;
  selectedModule?: string;
  openReportModal: (moduleName?: string) => void;
  closeReportModal: () => void;
  openListModal: () => void;
  closeListModal: () => void;
  addAnomaly: (payload: Omit<AnomalyReport, 'id' | 'createdAt' | 'status'>) => Promise<AnomalyReport>;
  updateAnomalyStatus: (id: string, status: 'nouveau' | 'en_cours' | 'resolu', notes?: string) => void;
  deleteAnomaly: (id: string) => void;
  clearAll: () => void;
}

const STORAGE_KEY = 'carisoft_demo_anomalies_v1';

const loadSavedAnomalies = (): AnomalyReport[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load anomalies from localStorage', e);
  }
  return [];
};

export const useAnomalyStore = create<AnomalyState>((set, get) => ({
  anomalies: loadSavedAnomalies(),
  isReportModalOpen: false,
  isListModalOpen: false,
  selectedModule: undefined,

  openReportModal: (moduleName) => {
    set({ isReportModalOpen: true, selectedModule: moduleName });
  },

  closeReportModal: () => {
    set({ isReportModalOpen: false, selectedModule: undefined });
  },

  openListModal: () => {
    set({ isListModalOpen: true });
  },

  closeListModal: () => {
    set({ isListModalOpen: false });
  },

  addAnomaly: async (payload) => {
    const newReport: AnomalyReport = {
      id: crypto.randomUUID(),
      title: payload.title.trim(),
      description: payload.description.trim(),
      module: payload.module || 'Général',
      severity: payload.severity || 'moyen',
      type: payload.type || 'bug',
      reporterName: payload.reporterName?.trim(),
      reporterContact: payload.reporterContact?.trim(),
      currentUrl: payload.currentUrl || window.location.pathname,
      systemInfo: payload.systemInfo || `${navigator.userAgent} (${window.innerWidth}x${window.innerHeight})`,
      createdAt: new Date().toISOString(),
      status: 'nouveau',
    };

    // Save to local storage
    const updated = [newReport, ...get().anomalies];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to persist anomaly locally', e);
    }

    set({ anomalies: updated, isReportModalOpen: false });

    // Optional Cloud Sync to Firestore collection 'anomalies'
    try {
      const { firestore } = await import('../lib/firebase');
      const { doc, setDoc } = await import('firebase/firestore');
      const docRef = doc(firestore, 'anomalies', newReport.id);
      await setDoc(docRef, {
        ...newReport,
        timestamp: new Date().toISOString(),
      });
    } catch (cloudErr) {
      console.warn('Could not sync anomaly report to Firestore cloud', cloudErr);
    }

    return newReport;
  },

  updateAnomalyStatus: (id, status, notes) => {
    const updated = get().anomalies.map((item) =>
      item.id === id
        ? { ...item, status, resolutionNotes: notes !== undefined ? notes : item.resolutionNotes }
        : item
    );
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to update anomaly locally', e);
    }
    set({ anomalies: updated });

    // Sync status change to Firestore if available
    import('../lib/firebase').then(({ firestore }) => {
      import('firebase/firestore').then(({ doc, updateDoc }) => {
        const docRef = doc(firestore, 'anomalies', id);
        updateDoc(docRef, { status, resolutionNotes: notes || '' }).catch(() => {});
      });
    }).catch(() => {});
  },

  deleteAnomaly: (id) => {
    const updated = get().anomalies.filter((item) => item.id !== id);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to delete anomaly locally', e);
    }
    set({ anomalies: updated });
  },

  clearAll: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear anomalies', e);
    }
    set({ anomalies: [] });
  },
}));
