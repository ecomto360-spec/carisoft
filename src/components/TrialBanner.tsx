import { useAuthStore } from '../store/authStore';
import React, { useState, useEffect } from 'react';
import { getRemainingTrialDays, initializeTrial } from '../lib/trialManager';
import { ActivationRequestModal } from './ActivationRequestModal';
import { LicenseActivationModal } from './licensing/LicenseActivationModal';
import { AlertTriangle, Lock, Key } from 'lucide-react';
import { activateLicense } from '../lib/licensing';

export function TrialBanner() {
  const { user } = useAuthStore();
  const isSuperAdmin = Boolean(user?.role === 'superadmin' || user?.email?.toLowerCase() === 'nabsterzero@gmail.com' || user?.username?.toLowerCase() === 'nabsterzero');
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [hasLicense, setHasLicense] = useState(false);
  
  useEffect(() => {
    // Check if license exists
    const checkStatus = async () => {
      if (!user?.companyId) return;
      const activeKey = localStorage.getItem(`carisoft_tenant_${user.companyId}_license_key`);
      
      if (activeKey) {
        setHasLicense(true);
        return;
      }
      
      await initializeTrial(user.companyId);
      const remaining = await getRemainingTrialDays(user.companyId);
      setDaysLeft(remaining);
    };
    
    checkStatus();

    const handleLicenseActivated = (e: any) => {
      if (e.detail?.companyId === user?.companyId) {
        setHasLicense(true);
      }
    };
    window.addEventListener('license_activated', handleLicenseActivated);
    return () => window.removeEventListener('license_activated', handleLicenseActivated);
  }, [user?.companyId]);

  if (!user || hasLicense || daysLeft === null || isSuperAdmin) return null;

  if (daysLeft <= 0) {
    return <TrialLockScreen />;
  }

  return (
    <>
      <div className="bg-amber-500 text-amber-950 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between z-40 relative shadow-md gap-2">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 opacity-80 shrink-0" />
          <span className="font-medium text-sm">
            Période d'essai : il vous reste {daysLeft} jour{daysLeft > 1 ? 's' : ''}.
          </span>
        </div>
        {user?.role === 'admin' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowRequestModal(true)}
              className="bg-amber-950 hover:bg-black text-amber-400 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors"
            >
              Acheter une licence
            </button>
            <button 
              onClick={() => setShowActivationModal(true)}
              className="bg-white/20 hover:bg-white/30 text-amber-950 border border-amber-950/20 px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-colors"
            >
              Activer
            </button>
          </div>
        )}
      </div>
      
      {showRequestModal && <ActivationRequestModal hwid="local-machine-id" onClose={() => setShowRequestModal(false)} />}
      {showActivationModal && <LicenseActivationModal onClose={() => setShowActivationModal(false)} />}
    </>
  );
}

function TrialLockScreen() {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);

  return (
    <div className="fixed inset-0 bg-slate-900 z-[200] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700 text-center">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Période d'essai terminée</h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          Votre période d'essai gratuit de 5 jours est arrivée à expiration. Pour continuer à utiliser CARISOFT.next, veuillez acquérir une licence.
        </p>

        <button 
          onClick={() => setShowRequestModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors mb-4"
        >
          Demander une licence
        </button>

        <button 
          onClick={() => setShowActivationModal(true)}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-colors mb-4 flex items-center justify-center gap-2"
        >
          <Key className="w-5 h-5" />
          Activer une clé
        </button>

        <a 
          href="https://wa.me/213554252579" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium py-3 rounded-xl transition-colors mb-8 flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          Nous contacter sur WhatsApp
        </a>
      </div>
      
      {showRequestModal && <ActivationRequestModal hwid="local-machine-id" onClose={() => setShowRequestModal(false)} />}
      {showActivationModal && <LicenseActivationModal onClose={() => setShowActivationModal(false)} />}
    </div>
  );
}
