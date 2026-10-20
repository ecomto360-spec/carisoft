import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { startLicenseWatcher, type LicenseCheckResult, verifyLicenseOffline } from '../lib/licensing';
import { getRemainingTrialDays, initializeTrial } from '../lib/trialManager';
import { ActivationRequestModal } from './ActivationRequestModal';
import { LicenseActivationModal } from './licensing/LicenseActivationModal';
import { AlertTriangle, Lock, Key, Clock, ShieldAlert } from 'lucide-react';

export function TrialBanner() {
  const { user } = useAuthStore();
  const isSuperAdmin = Boolean(
    user?.role === 'superadmin' || 
    user?.email?.toLowerCase() === 'nabsterzero@gmail.com' || 
    user?.username?.toLowerCase() === 'nabsterzero'
  );

  const [licenseResult, setLicenseResult] = useState<LicenseCheckResult | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState<number | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);

  const tenantId = user?.companyId || 'default-company';

  useEffect(() => {
    if (!user || isSuperAdmin) return;

    // 1. Démarrer le watcher de licence (vérification au démarrage + toutes les heures)
    const unsubscribe = startLicenseWatcher(tenantId, async (res) => {
      setLicenseResult(res);

      // Si aucune licence n'est enregistrée, vérifier la période d'essai 5 jours de base
      if (res.status === 'none') {
        await initializeTrial(tenantId);
        const remaining = await getRemainingTrialDays(tenantId);
        setTrialDaysLeft(remaining);
      }
    });

    // 2. Écouteur d'événement d'activation immédiate
    const handleLicenseActivated = async (e: any) => {
      if (e.detail?.tenantId === tenantId || e.detail?.companyId === tenantId) {
        const fresh = await verifyLicenseOffline(tenantId);
        setLicenseResult(fresh);
      }
    };

    window.addEventListener('license_activated', handleLicenseActivated);

    return () => {
      unsubscribe();
      window.removeEventListener('license_activated', handleLicenseActivated);
    };
  }, [user, tenantId, isSuperAdmin]);

  if (!user || isSuperAdmin) return null;

  // CAS 1 : Recul d'horloge détecté (Anti-triche)
  if (licenseResult?.status === 'tampered') {
    return (
      <LockScreen 
        icon={<Clock className="w-10 h-10 text-amber-500" />}
        title="Date système invalide"
        message={licenseResult.message || "Une modification de l'horloge système a été détectée (recul d'horloge). Veuillez rétablir l'heure correcte de votre ordinateur pour continuer."}
        onOpenActivation={() => setShowActivationModal(true)}
        onOpenRequest={() => setShowRequestModal(true)}
      />
    );
  }

  // CAS 2 : Licence révoquée par le SuperAdmin
  if (licenseResult?.status === 'revoked') {
    return (
      <LockScreen 
        icon={<ShieldAlert className="w-10 h-10 text-rose-500" />}
        title="Licence révoquée"
        message={licenseResult.message || "Cette licence a été révoquée par l'administrateur. Veuillez activer une nouvelle clé de licence valide."}
        onOpenActivation={() => setShowActivationModal(true)}
        onOpenRequest={() => setShowRequestModal(true)}
      />
    );
  }

  // CAS 3 : Licence invalide (mauvaise machine ou contrefaite)
  if (licenseResult?.status === 'invalid') {
    return (
      <LockScreen 
        icon={<Lock className="w-10 h-10 text-rose-500" />}
        title="Poste non autorisé"
        message={licenseResult.message || "Cette licence est activée sur un autre ordinateur ou est invalide."}
        onOpenActivation={() => setShowActivationModal(true)}
        onOpenRequest={() => setShowRequestModal(true)}
      />
    );
  }

  // CAS 4 : Licence expirée
  if (licenseResult?.status === 'expired') {
    return (
      <LockScreen 
        icon={<Lock className="w-10 h-10 text-rose-500" />}
        title="Licence expirée"
        message="Votre licence CARISOFT.next est arrivée à expiration. Pour continuer à accéder à vos données, veuillez renouveler ou activer une nouvelle licence."
        onOpenActivation={() => setShowActivationModal(true)}
        onOpenRequest={() => setShowRequestModal(true)}
      />
    );
  }

  // CAS 5 : Aucune licence - Période d'essai initiale terminée
  if (licenseResult?.status === 'none' && trialDaysLeft !== null && trialDaysLeft <= 0) {
    return (
      <LockScreen 
        icon={<Lock className="w-10 h-10 text-rose-500" />}
        title="Période d'essai terminée"
        message="Votre période d'essai gratuit est terminée. Pour continuer à utiliser CARISOFT.next, veuillez activer votre licence."
        onOpenActivation={() => setShowActivationModal(true)}
        onOpenRequest={() => setShowRequestModal(true)}
      />
    );
  }

  // ✅ CAS 6 : Licence active mais approche de l'échéance (Avertissement J-10 et moins)
  // Le bandeau DISPARAÎT automatiquement si la licence est valide et qu'il reste PLUS de 10 jours.
  const isNearExpiry = licenseResult?.status === 'active' && licenseResult.daysRemaining <= 10;
  const isTrialActive = licenseResult?.status === 'none' && trialDaysLeft !== null && trialDaysLeft > 0;

  if (isNearExpiry || isTrialActive) {
    const days = isNearExpiry ? licenseResult!.daysRemaining : trialDaysLeft!;
    const label = isNearExpiry ? "Licence" : "Période d'essai";

    // Style plus urgent à J-3 et J-1
    const isUrgent = days <= 3;
    const bannerBg = isUrgent ? "bg-rose-600 text-white" : "bg-amber-500 text-amber-950";

    return (
      <>
        <div className={`${bannerBg} px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between z-40 relative shadow-md gap-2`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 opacity-90" />
            <span className="font-medium text-sm">
              {label} : il vous reste <strong>{days} jour{days > 1 ? 's' : ''}</strong> avant expiration.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowRequestModal(true)}
              className="bg-slate-900 hover:bg-black text-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors"
            >
              Demander
            </button>
            <button 
              onClick={() => setShowActivationModal(true)}
              className="bg-white/20 hover:bg-white/30 text-current border border-current/20 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-colors flex items-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              Activer une clé
            </button>
          </div>
        </div>

        {showRequestModal && <ActivationRequestModal hwid="local-machine-id" onClose={() => setShowRequestModal(false)} />}
        {showActivationModal && <LicenseActivationModal onClose={() => setShowActivationModal(false)} />}
      </>
    );
  }

  return (
    <>
      {showRequestModal && <ActivationRequestModal hwid="local-machine-id" onClose={() => setShowRequestModal(false)} />}
      {showActivationModal && <LicenseActivationModal onClose={() => setShowActivationModal(false)} />}
    </>
  );
}

interface LockScreenProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  onOpenActivation: () => void;
  onOpenRequest: () => void;
}

function LockScreen({ icon, title, message, onOpenActivation, onOpenRequest }: LockScreenProps) {
  const [showModal, setShowModal] = useState(false);
  const [showReqModal, setShowReqModal] = useState(false);

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[200] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 rounded-3xl p-8 shadow-2xl border border-slate-800 text-center">
        <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-6">
          {icon}
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
        <p className="text-slate-400 mb-8 leading-relaxed text-sm">
          {message}
        </p>

        <button 
          onClick={() => setShowModal(true)}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-colors mb-3 flex items-center justify-center gap-2"
        >
          <Key className="w-5 h-5" />
          Saisir une clé de licence
        </button>

        <button 
          onClick={() => setShowReqModal(true)}
          className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-xl transition-colors mb-6 text-sm"
        >
          Demander une licence
        </button>

        <a 
          href="https://wa.me/213554252579" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
          Support WhatsApp
        </a>
      </div>

      {showModal && <LicenseActivationModal onClose={() => setShowModal(false)} />}
      {showReqModal && <ActivationRequestModal hwid="local-machine-id" onClose={() => setShowReqModal(false)} />}
    </div>
  );
}