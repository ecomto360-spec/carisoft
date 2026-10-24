import { useState } from 'react';
import { 
  ShieldCheck, Check, Sparkles, KeyRound, Clock, 
  Crown, X, ArrowRight, CheckCircle2, AlertCircle, Phone, Mail
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { OFFICIAL_PAID_PLANS } from '../../lib/security';
import { activateLicense } from '../../lib/licensing';
import { db } from '../../db/db';

interface PaidLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function PaidLicenseModal({ isOpen, onClose, onSuccess }: PaidLicenseModalProps) {
  const [selectedPlanId, setSelectedPlanId] = useState('plan_1y');
  const [inputKey, setInputKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleActivate = async () => {
    setError(null);
    setSuccess(null);
    setActivating(true);

    if (!inputKey.trim()) {
      setError('Veuillez saisir votre clé de licence officielle.');
      setActivating(false);
      return;
    }

    try {
      const settings = await db.settings.get(1);
      const companyName = settings?.name || 'SARL MAHAJIR SIDAR';
      
      const payload = await activateLicense(inputKey.trim(), companyName);
      const planObj = OFFICIAL_PAID_PLANS.find(p => p.id === selectedPlanId) || OFFICIAL_PAID_PLANS[2];
      const expiry = payload.expiresAt || new Date(Date.now() + planObj.durationDays * 24 * 60 * 60 * 1000).toISOString();

      await db.settings.update(1, {
        licenseKey: inputKey.trim(),
        licensePlan: planObj.name,
        licenseExpiry: expiry,
        licenseStatus: 'active'
      });

      setSuccess(`Félicitations ! Votre licence payante ${planObj.name} a été activée.`);
      setTimeout(() => {
        if (onSuccess) onSuccess();
        onClose();
      }, 1500);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Erreur lors de l\'activation de la licence.');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl p-6 sm:p-8 text-white shadow-2xl space-y-6 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Crown className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Licences Officielles CARISOFT.next
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                  SaaS Pro
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Poursuivez l'exploitation de votre carrière avec nos formules certifiées 3 Mois, 6 Mois ou 1 An
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 3 Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {OFFICIAL_PAID_PLANS.map((plan) => {
            const isSelected = selectedPlanId === plan.id;
            return (
              <div 
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`relative rounded-2xl p-5 cursor-pointer transition-all border flex flex-col justify-between ${
                  isSelected 
                    ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/20 scale-[1.02]' 
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-2.5 right-4 bg-amber-500 text-slate-950 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Recommandé
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <h3 className="font-bold text-sm text-slate-200">{plan.name}</h3>
                    <p className="text-xs text-slate-400">{plan.durationLabel}</p>
                  </div>

                  <div className="text-xl font-extrabold text-white">
                    {plan.price}
                  </div>

                  <ul className="space-y-2 pt-2 border-t border-slate-800/80">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800">
                  <div className={`text-center py-1.5 rounded-xl text-xs font-semibold ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isSelected ? 'Sélectionné' : 'Choisir ce pack'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Activation Section */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
            <KeyRound className="h-4 w-4 text-blue-400" />
            Activer votre Clé de Licence Payante
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/50 rounded-xl text-xs text-red-200 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/50 rounded-xl text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5">
            <input 
              type="text"
              placeholder="CARI-XXXX-XXXX-XXXX-XXXX"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-blue-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button 
              onClick={handleActivate}
              disabled={activating}
              className="bg-blue-600 hover:bg-blue-500 text-xs px-6 py-2.5"
            >
              {activating ? 'Vérification...' : 'Valider & Débloquer'}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80 gap-2">
            <span>Besoin d'une clé de licence immédiate ?</span>
            <div className="flex items-center gap-3">
              <span className="text-purple-300 flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> nabsterzero@gmail.com
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
