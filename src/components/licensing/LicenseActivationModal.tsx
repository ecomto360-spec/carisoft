import React, { useState } from 'react';
import { Key, CheckCircle, X, ShieldCheck, Laptop } from 'lucide-react';
import { activateLicense, getMachineId } from '../../lib/licensing';
import { useAuthStore } from '../../store/authStore';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export function LicenseActivationModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuthStore();
  const settings = useLiveQuery(() => db.settings.get(1));
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const tenantId = user?.companyId || (settings as any)?.companyId || 'default-company';

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;

    setLoading(true);
    setError('');

    try {
      const payload = await activateLicense(key.trim(), tenantId);
      const remainingDays = typeof payload.days_remaining === 'number'
        ? payload.days_remaining
        : (payload.expiresAt ? Math.ceil((new Date(payload.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0);

      setSuccess(`Licence validée et liée à cet ordinateur avec succès (${remainingDays} jours restants).`);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.warn("Erreur activation licence:", err);
      setError(typeof err === "string" ? err : (err?.message || "Erreur lors de l'activation de la licence."));
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
          <div>
            <h2 className="text-xl font-bold text-white">Activer une licence</h2>
            <p className="text-xs text-slate-400">Licence liée à un seul poste de travail</p>
          </div>
        </div>

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-xl p-4 flex items-center gap-3 text-emerald-400">
            <CheckCircle className="w-6 h-6 shrink-0" />
            <span className="font-medium text-sm">{success}</span>
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
                Clé de licence (format CARI-XXXX-XXXX-XXXX-XXXX)
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toUpperCase())}
                  placeholder="CARI-ABCD-EFGH-JKLM-NPQR"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-blue-500 pl-10"
                  required
                />
                <Key className="w-5 h-5 text-slate-500 absolute left-3 top-3.5" />
              </div>
              <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1">
                <Laptop className="w-3.5 h-3.5" />
                Connexion requise uniquement lors de la 1re activation.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading || !key.trim()}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                {loading ? 'Activation en cours...' : 'Activer maintenant'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
