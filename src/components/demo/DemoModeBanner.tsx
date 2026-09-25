import { useState } from 'react';
import { Sparkles, Bug, Copy, Check, LogOut, ExternalLink, X } from 'lucide-react';
import { isDemoSession, getShareableDemoUrl } from '../../lib/demoAuth';
import { useAnomalyStore } from '../../store/anomalyStore';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';

export function DemoModeBanner() {
  const isDemo = isDemoSession();
  const { openReportModal } = useAnomalyStore();
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!isDemo || isDismissed) return null;

  const handleCopyLink = () => {
    const url = getShareableDemoUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExitDemo = () => {
    sessionStorage.removeItem('carisoft_demo_session_active');
    localStorage.removeItem('carisoft_demo_session_active');
    logout();
    navigate('/login');
  };

  return (
    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-3 py-1.5 text-xs border-b border-blue-500/30 shadow-sm relative z-30 animate-in fade-in duration-200">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
            <Sparkles className="h-3 w-3" />
            Mode Démo Client
          </span>
          <span className="text-slate-200 hidden sm:inline">
            Espace de test sans mot de passe • Toutes les fonctionnalités sont disponibles.
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Signaler anomalie */}
          <button
            type="button"
            onClick={() => openReportModal()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[11px] transition-colors cursor-pointer shadow-xs"
          >
            <Bug className="h-3.5 w-3.5" />
            <span>Signaler une anomalie</span>
          </button>

          {/* Copier lien démo */}
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium text-[11px] transition-colors cursor-pointer"
            title="Copier le lien démo direct"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            <span className="hidden md:inline">{copied ? 'Lien copié !' : 'Copier lien démo'}</span>
          </button>

          {/* Quitter démo */}
          <button
            type="button"
            onClick={handleExitDemo}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Quitter le mode démo"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>

          {/* Fermer bandeau */}
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Masquer ce bandeau"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
