import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, X, ArrowRight, Bell } from 'lucide-react';
import { useNotificationStore } from '../../store/notificationStore';

export function NotificationToast() {
  const { activeToast, dismissToast, markAsRead } = useNotificationStore();
  const navigate = useNavigate();

  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      dismissToast();
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeToast, dismissToast]);

  if (!activeToast) return null;

  const handleClick = () => {
    markAsRead(activeToast.id);
    dismissToast();
    if (activeToast.link) {
      navigate(activeToast.link);
    } else {
      navigate('/orders');
    }
  };

  return (
    <div className="fixed top-20 right-4 rtl:right-auto rtl:left-4 z-50 max-w-sm w-[calc(100vw-2rem)] animate-in slide-in-from-top-4 fade-in duration-200">
      <div 
        onClick={handleClick}
        className="bg-slate-900/95 text-white p-4 rounded-2xl shadow-2xl border border-blue-500/40 backdrop-blur-md flex items-start gap-3 cursor-pointer group hover:border-blue-400 transition-all hover:scale-[1.01]"
      >
        {/* Animated Badge Icon */}
        <div className="relative shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 text-blue-400 text-xs font-bold uppercase tracking-wider">
            <Bell className="h-3 w-3" />
            <span>Nouvelle Commande</span>
          </div>
          <p className="font-bold text-sm text-white truncate">
            {activeToast.title}
          </p>
          <p className="text-xs text-slate-300 line-clamp-2">
            {activeToast.message}
          </p>
          <div className="pt-1 flex items-center gap-1 text-xs text-blue-400 font-semibold group-hover:text-blue-300">
            <span>Ouvrir la commande</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissToast();
          }}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 -mr-1 -mt-1 cursor-pointer"
          title="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
