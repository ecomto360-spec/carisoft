import { useState } from 'react';
import { Bug, Sparkles, X, ChevronUp, MessageSquarePlus } from 'lucide-react';
import { useAnomalyStore } from '../../store/anomalyStore';
import { isDemoSession } from '../../lib/demoAuth';

export function FloatingAnomalyButton() {
  const { openReportModal } = useAnomalyStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const isDemo = isDemoSession();

  if (isDismissed) {
    return (
      <button
        type="button"
        onClick={() => setIsDismissed(false)}
        className="fixed bottom-4 left-4 rtl:left-auto rtl:right-4 z-40 p-2.5 rounded-full bg-slate-900 text-amber-400 shadow-xl hover:scale-105 transition-all cursor-pointer border border-amber-500/30"
        title="Ouvrir le formulaire d'anomalie"
      >
        <Bug className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 left-5 rtl:left-auto rtl:right-5 z-40 flex items-center gap-1.5 animate-in slide-in-from-bottom-5 duration-300">
      <button
        type="button"
        onClick={() => openReportModal()}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950 text-white font-semibold text-xs shadow-2xl hover:shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer border border-amber-500/40 group"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <Bug className="h-4 w-4 text-amber-400 group-hover:rotate-12 transition-transform" />
        <span className="tracking-wide">Signaler une anomalie</span>
        {isDemo && (
          <span className="bg-amber-500/30 text-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-amber-500/40">
            DÉMO
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        className="p-1.5 rounded-full bg-slate-900/80 text-slate-400 hover:text-white border border-slate-700/60 shadow-md transition-colors cursor-pointer"
        title="Réduire"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
