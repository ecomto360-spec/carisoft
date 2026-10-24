/**
 * Gestionnaire d'affichage de la licence CARISOFT.next
 * En mode Tauri natif, la source de vérité absolue est Rust (license_status, champ days_remaining).
 * Sans licence active : aucun accès, l'interface renvoie 0 jour restant.
 */

export const getRemainingTrialDays = async (_companyId?: string): Promise<number> => {
  if (typeof window !== 'undefined') {
    const win = window as any;
    const isTauri = Boolean(win.__TAURI_INTERNALS__ || win.__TAURI__);
    if (isTauri) {
      const invokeFn = win.__TAURI_INTERNALS__?.invoke || win.__TAURI__?.invoke || win.__TAURI__?.core?.invoke;
      if (typeof invokeFn === 'function') {
        try {
          const status = await invokeFn('license_status');
          if (status && status.status === 'active' && typeof status.days_remaining === 'number') {
            return status.days_remaining;
          }
          return 0;
        } catch (e) {
          console.warn("license_status error:", e);
          return 0;
        }
      }
    }
  }
  return 0;
};

export const isTrialExpired = async (companyId?: string): Promise<boolean> => {
  const days = await getRemainingTrialDays(companyId);
  return days <= 0;
};

export const initializeTrial = async (_companyId?: string): Promise<void> => {
  // Pas d'essai local non authentifié : l'accès requiert une licence Firestore officielle
};
