import { useState, useRef, useEffect } from 'react';
import { Menu, User, Bell, LogOut, ShieldCheck, KeyRound, ChevronDown, Sparkles, Crown, Bug, Copy, Check, ListFilter } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { LicenseActivationModal } from '../licensing/LicenseActivationModal';
import { PaidLicenseModal } from '../licensing/PaidLicenseModal';
import { useTranslation } from '../../i18n';
import { LanguageSelector } from '../common/LanguageSelector';
import { NotificationDropdown } from '../notifications/NotificationDropdown';
import { useAnomalyStore } from '../../store/anomalyStore';
import { getShareableDemoUrl } from '../../lib/demoAuth';

export function Header() {
  
  const { user } = useAuthStore();
  const currentCompanyId = user?.companyId || '';

  const { toggleSidebar } = useAppStore();
  const { logout } = useAuthStore();
  const { t } = useTranslation();
  const isSuperAdmin = Boolean(
    user?.role === 'superadmin' || 
    user?.email?.toLowerCase() === 'nabsterzero@gmail.com' || 
    user?.username?.toLowerCase() === 'nabsterzero'
  );
  const navigate = useNavigate();

  const settings = useLiveQuery(() => db.settings.get(1));
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPaidModal, setShowPaidModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [copiedDemo, setCopiedDemo] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { openReportModal, openListModal, anomalies } = useAnomalyStore();

  const handleCopyDemo = () => {
    const url = getShareableDemoUrl();
    navigator.clipboard.writeText(url);
    setCopiedDemo(true);
    setTimeout(() => setCopiedDemo(false), 2500);
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {

    if (window.confirm(t.header.logoutConfirm)) {
      logout();
      navigate('/login', { replace: true });
    }
  };

  const isTrial = settings?.licensePlan?.includes('Essai') || settings?.licensePlan?.includes('5 Jours');

  const expiryDays = settings?.licenseExpiry 
    ? Math.max(0, Math.ceil((new Date(settings.licenseExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 365;

  const roleLabel = {
    superadmin: t.roles.superadmin,
    admin: t.roles.admin,
    manager: t.roles.manager,
    billing: t.roles.billing,
    viewer: t.roles.viewer
  }[user?.role || 'admin'] || t.roles.user;

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-3 sm:px-4 sticky top-0 z-20 shadow-xs">
      <div className="flex items-center gap-2 sm:gap-3">
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          title={t.header.toggleMenu}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile App Name */}
        <div className="lg:hidden flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
            C
          </div>
          <span className="font-black text-slate-800 text-sm tracking-tight">
            CARISOFT<span className="text-blue-600">.next</span>
          </span>
        </div>

        {/* License Badge */}
        {isSuperAdmin ? (
            <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs text-emerald-800 font-medium">
              <Crown className="h-4 w-4 text-amber-500 shrink-0" />
              <span>SUPER ADMIN</span>
              <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-full">
                ILLIMITÉE
              </span>
            </div>
        ) : (
          isTrial ? (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-300 rounded-full text-xs text-amber-900 font-medium">
              <Sparkles className="h-4 w-4 text-amber-600 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
              <span>{t.header.freeTrial} : <strong>{expiryDays} {t.header.daysRemaining}</strong></span>
              {user?.role === 'admin' && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowPaidModal(true)}
                    className="ml-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs transition-transform hover:scale-105"
                  >
                    {t.header.buyLicense}
                  </button>
                  <button
                    onClick={() => setShowActivationModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs transition-transform hover:scale-105"
                  >
                    Activer
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div 
              onClick={() => user?.role === 'admin' && setShowPaidModal(true)}
              className={`hidden md:flex items-center gap-2 px-3 py-1 ${
                expiryDays <= 14 
                  ? 'bg-amber-50 border-amber-300 text-amber-800' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              } ${user?.role === 'admin' ? 'cursor-pointer hover:opacity-80' : ''} border rounded-full text-xs font-medium transition-colors`}
              title="Consulter ou mettre à niveau la licence"
            >
              <ShieldCheck className={`h-4 w-4 shrink-0 ${expiryDays <= 14 ? 'text-amber-600' : 'text-emerald-600'}`} />
              <span>
                {expiryDays <= 14 
                  ? `Expire dans ${expiryDays} jour(s)` 
                  : `${settings?.licensePlan?.includes('Essai') ? 'Clé activée' : (settings?.licensePlan || 'Clé activée')} (${expiryDays} j)`}
              </span>
              <span className={`text-[10px] text-white font-bold px-1.5 py-0.2 rounded-full ${expiryDays <= 14 ? 'bg-amber-600' : 'bg-emerald-600'}`}>
                PRO
              </span>
            </div>
          )
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Language Switcher */}
        <LanguageSelector variant="header" />

        {/* Quick Anomaly Report Button */}
        <button
          type="button"
          onClick={() => openReportModal()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-semibold transition-all cursor-pointer shadow-2xs group"
          title="Signaler une anomalie ou suggestion"
        >
          <Bug className="h-4 w-4 text-amber-600 shrink-0 group-hover:rotate-12 transition-transform" />
          <span className="hidden md:inline">Signaler anomalie</span>
        </button>

        {/* Notifications Popover */}
        <NotificationDropdown />

        {/* User Profile Menu */}
        <div className="relative pl-2 rtl:pl-0 rtl:pr-2 border-l rtl:border-l-0 rtl:border-r border-slate-200" ref={menuRef}>
          <button 
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-start"
          >
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-xs shadow-xs">
              {(user?.name || user?.username || 'A').slice(0, 1).toUpperCase()}
            </div>
            <div className="hidden md:block text-xs leading-tight">
              <p className="font-semibold text-slate-800">{user?.name || user?.username || 'Administrateur'}</p>
              <p className="text-slate-400 capitalize">{roleLabel}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden md:block" />
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in">
              <div className="px-4 py-2 border-b border-slate-100 text-start">
                <p className="text-xs font-semibold text-slate-800 truncate">{user?.name || user?.username}</p>
                <p className="text-[11px] text-slate-400 truncate">{user?.email || 'admin@carisoft.com'}</p>
              </div>

              <div className="py-1">
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/superadmin');
                      }}
                      className="w-full px-4 py-2 text-start text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      Tableau de bord SuperAdmin
                    </button>
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setShowPaidModal(true);
                      }}
                      className="w-full px-4 py-2 text-start text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <Crown className="h-4 w-4 text-amber-500" />
                      {t.header.licensesPlans}
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/users');
                  }}
                  className="w-full px-4 py-2 text-start text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                >
                  <KeyRound className="h-4 w-4 text-slate-500" />
                  {t.header.manageAccess}
                </button>

                {/* Demo Client & Anomaly options */}
                <div className="pt-1 mt-1 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      openReportModal();
                    }}
                    className="w-full px-4 py-2 text-start text-xs text-amber-800 hover:bg-amber-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Bug className="h-4 w-4 text-amber-600" />
                    <span>Signaler une anomalie</span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      openListModal();
                    }}
                    className="w-full px-4 py-2 text-start text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <ListFilter className="h-4 w-4 text-blue-600" />
                      <span>Anomalies signalées</span>
                    </span>
                    {anomalies.length > 0 && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                        {anomalies.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={handleCopyDemo}
                    className="w-full px-4 py-2 text-start text-xs text-indigo-700 hover:bg-indigo-50 flex items-center justify-between cursor-pointer font-medium"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                      <span>Copier lien Démo Client</span>
                    </span>
                    {copiedDemo ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-indigo-400" />}
                  </button>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-start text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium cursor-pointer"
                >
                  <LogOut className="h-4 w-4 text-red-500" />
                  {t.menu.logout}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Paid Licenses Modal */}
      {showPaidModal && (
        <PaidLicenseModal 
          isOpen={showPaidModal} 
          onClose={() => setShowPaidModal(false)} 
        />
      )}
      
      {/* License Activation Modal */}
      {showActivationModal && (
        <LicenseActivationModal onClose={() => setShowActivationModal(false)} />
      )}
    </header>
  );
}
