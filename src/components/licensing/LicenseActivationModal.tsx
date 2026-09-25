import React, { useState } from 'react';
import { Key, CheckCircle, X, ShieldCheck } from 'lucide-react';
import { verifyLicenseKey } from '../../lib/security';
import { db } from '../../db/db';
import { firestore } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '../../store/authStore';
import { useLiveQuery } from 'dexie-react-hooks';

export function LicenseActivationModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const settings = useLiveQuery(() => db.settings.get(1));
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      // 1. Verify license using existing logic
      const verification = await verifyLicenseKey(key.trim(), settings?.name || 'CARRIERE');

      
      if (!verification.valid) {
        setError(verification.reason || 'Clé de licence invalide ou expirée.');
        setLoading(false);
        return;
      }

      // 2. Compute expiry
      const updatedExpiry = verification.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      // 3. Update local DB
      await db.settings.update(1, {
        licenseKey: key.trim(),
        licenseExpiry: updatedExpiry,
        licenseStatus: 'active',
        licensePlan: 'Clé activée'
      });

      // 4. Update Firestore for the tenant (if possible)
      if (user?.companyId) {
        try {
          const tenantRef = doc(firestore, 'companies', user.companyId);
          await updateDoc(tenantRef, {
            licenseKey: key.trim(),
            licenseExpiry: updatedExpiry,
            licenseStatus: 'active',
        licensePlan: 'Clé activée'
          });
        } catch (fbErr) {
          console.warn("Could not sync license to Firestore (offline or no permission). Local activation successful.", fbErr);
        }
      }

      // 5. Set active license in localStorage to hide banner immediately
      if (user?.companyId) {
        localStorage.setItem(`carisoft_tenant_${user.companyId}_license_key`, key.trim());
        window.dispatchEvent(new CustomEvent('license_activated', { detail: { companyId: user.companyId } }));
      }
      
      
      // Also update AuthStore if there's a field for it, though db.settings is reactive.

      setSuccess(`Licence validée avec succès (${verification.daysRemaining || 365} jours restants).`);
      
      // Auto-close cleanly after a brief moment to show success message
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err: any) {
      console.warn(err);
      setError("Erreur lors de l'activation de la licence.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-white">Activer une licence</h2>
        </div>

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-4 flex items-center gap-3 text-emerald-400">
            <CheckCircle className="w-6 h-6 shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
        ) : (
          <form onSubmit={handleActivate} className="space-y-4">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/50 rounded-xl p-3 text-rose-400 text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Clé de licence
              </label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text" 
                  required
                  placeholder="CARI-XXXX-XXXX-XXXX"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading || !key.trim()}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? "Vérification..." : "Vérifier & Activer"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
