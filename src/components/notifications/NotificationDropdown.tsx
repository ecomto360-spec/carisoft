import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, CheckCheck, Trash2, Volume2, VolumeX, 
  ShoppingCart, ExternalLink, X, BellOff, Sparkles 
} from 'lucide-react';
import { useNotificationStore, AppNotification } from '../../store/notificationStore';
import { useTranslation } from '../../i18n';

function formatTimeAgo(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHours = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSec < 45) return "À l'instant";
    if (diffMin < 60) return `Il y a ${diffMin} min`;
    if (diffHours < 24) return `Il y a ${diffHours} h`;
    if (diffDays === 1) return "Hier";
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Récemment';
  }
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const {
    notifications,
    unreadCount,
    soundEnabled,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    toggleSound,
    notifyNewOrder,
  } = useNotificationStore();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    } else {
      navigate('/orders');
    }
  };

  const handleTestNotification = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    notifyNewOrder({
      id: crypto.randomUUID(),
      number: `CMD-2026-${randomNum}`,
      customerName: 'Client Démo (Test Direct)',
      amount: 85400,
    });
  };

  return (
    <div className="relative" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-xl transition-all cursor-pointer relative ${
          isOpen
            ? 'bg-blue-50 text-blue-600 shadow-inner'
            : 'hover:bg-slate-100 text-slate-600 hover:text-slate-800'
        }`}
        title={t.header.notifications}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell className={`h-5 w-5 transition-transform duration-200 ${unreadCount > 0 ? 'animate-bell-ring' : ''}`} />
        
        {unreadCount > 0 ? (
          <>
            {/* Pulsing indicator */}
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex items-center justify-center px-1 h-4 min-w-4 rounded-full bg-red-600 text-white font-bold text-[10px] shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </span>
          </>
        ) : (
          /* Subtle dot if notifications exist but all read */
          notifications.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-slate-300 rounded-full"></span>
          )
        )}
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 rtl:right-auto rtl:left-0 mt-2.5 w-84 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-400" />
              <h3 className="font-semibold text-sm tracking-tight">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-blue-500 text-white text-[11px] font-bold px-1.5 py-0.2 rounded-full">
                  {unreadCount} {unreadCount > 1 ? 'nouvelles' : 'nouvelle'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {/* Sound Toggle */}
              <button
                type="button"
                onClick={toggleSound}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  soundEnabled 
                    ? 'text-slate-300 hover:text-white hover:bg-slate-700/60' 
                    : 'text-amber-400 hover:bg-slate-700/60'
                }`}
                title={soundEnabled ? 'Son activé (cliquer pour couper)' : 'Son coupé (cliquer pour activer)'}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>

              {/* Mark all as read */}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
                  title="Tout marquer comme lu"
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
              )}

              {/* Clear all */}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
                  title="Effacer tout l'historique"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors ml-1 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sound Status Pill if muted */}
          {!soundEnabled && (
            <div className="bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 border-b border-amber-200/60 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <VolumeX className="h-3.5 w-3.5 text-amber-600" />
                Le carillon sonore est désactivé
              </span>
              <button
                type="button"
                onClick={toggleSound}
                className="font-bold underline text-amber-900 cursor-pointer"
              >
                Activer
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <BellOff className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Aucune notification</p>
                  <p className="text-xs text-slate-400 max-w-[240px] mx-auto leading-relaxed">
                    Chaque nouvelle commande enregistrée déclenchera automatiquement une alerte ici.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                  Créer une notification test
                </button>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => handleNotificationClick(notif)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer group relative ${
                    !notif.read ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                      !notif.read
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <ShoppingCart className="h-4 w-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs font-bold truncate ${!notif.read ? 'text-slate-900' : 'text-slate-700'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatTimeAgo(notif.timestamp)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug break-words">
                      {notif.message}
                    </p>

                    <div className="flex items-center gap-2 pt-0.5 text-[11px] font-medium text-blue-600">
                      <span className="inline-flex items-center gap-1 group-hover:underline">
                        Consulter la commande
                        <ExternalLink className="h-3 w-3" />
                      </span>
                      {!notif.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                      )}
                    </div>
                  </div>

                  {/* Delete Item Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotification(notif.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 hover:bg-slate-200/60 rounded-md transition-all shrink-0 cursor-pointer"
                    title="Supprimer cette notification"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleTestNotification}
              className="text-[11px] font-medium text-slate-500 hover:text-blue-600 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <Sparkles className="h-3 w-3 text-amber-500" />
              Tester le son & alerte
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/orders');
              }}
              className="font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer flex items-center gap-1"
            >
              Toutes les commandes
              <ExternalLink className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
