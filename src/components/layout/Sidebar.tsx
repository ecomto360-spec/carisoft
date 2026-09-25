import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { useAuthStore } from '../../store/authStore';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n';
import { 
  LayoutDashboard, Users, Package, Truck, 
  FileText, Receipt, CreditCard, Settings,
  DatabaseBackup, BarChart3, Users2, FileSpreadsheet,
  LogOut, X
} from 'lucide-react';

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();
  const { logout, user } = useAuthStore();
  const { t, isRTL } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const MENU_ITEMS = [
    { name: t.menu.dashboard, path: '/', icon: LayoutDashboard },
    { name: t.menu.clients, path: '/clients', icon: Users },
    { name: t.menu.products, path: '/products', icon: Package },
    { name: t.menu.logistics, path: '/logistics', icon: Truck },
    { name: t.menu.orders, path: '/orders', icon: FileSpreadsheet },
    { name: t.menu.deliveries, path: '/deliveries', icon: FileText },
    { name: t.menu.invoices, path: '/invoices', icon: Receipt },
    { name: t.menu.payments, path: '/payments', icon: CreditCard },
    { name: t.menu.reports, path: '/reports', icon: BarChart3 },
    { name: t.menu.users, path: '/users', icon: Users2 },
    { name: t.menu.settings, path: '/settings', icon: Settings },
    { name: t.menu.maintenance, path: '/maintenance', icon: DatabaseBackup },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleItemClick = () => {
    // Close sidebar on mobile upon navigation
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={cn(
          "bg-slate-900 text-white flex flex-col h-full select-none z-50 transition-all duration-300 ease-in-out",
          // Mobile: Fixed drawer
          "fixed inset-y-0 left-0 rtl:left-auto rtl:right-0 lg:static",
          sidebarOpen 
            ? "translate-x-0 w-72 lg:w-64 shadow-2xl lg:shadow-none" 
            : isRTL 
              ? "translate-x-full lg:translate-x-0 lg:w-16"
              : "-translate-x-full lg:translate-x-0 lg:w-16"
        )}
      >
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-base shadow-sm">
              C
            </div>
            {(sidebarOpen || window.innerWidth < 1024) && (
              <div>
                <h1 className="text-lg font-black tracking-tight text-white leading-none">
                  CARISOFT<span className="text-blue-400">.next</span>
                </h1>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide block mt-0.5">
                  {t.appSubtitle}
                </span>
              </div>
            )}
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto py-3 overscroll-contain">
          <ul className="space-y-1 px-2.5">
            {MENU_ITEMS.map((item) => {
              const isActive = location.pathname === item.path || 
                               (item.path !== '/' && location.pathname.startsWith(item.path));
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={handleItemClick}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm font-medium",
                      isActive 
                        ? "bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/25" 
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white",
                      !sidebarOpen && "lg:justify-center lg:px-0"
                    )}
                    title={!sidebarOpen ? item.name : undefined}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {(sidebarOpen || window.innerWidth < 1024) && (
                      <span className="truncate">{item.name}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar Footer with Active User & Logout */}
        <div className="p-3 border-t border-slate-800 space-y-2 shrink-0 bg-slate-900/90">
          {(sidebarOpen || window.innerWidth < 1024) && user && (
            <div className="px-3 py-2 bg-slate-800/60 rounded-xl text-xs text-slate-400 flex items-center justify-between border border-slate-700/40">
              <div className="truncate pr-2 rtl:pr-0 rtl:pl-2">
                <p className="truncate font-bold text-white text-xs">{user.name || user.username}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email || 'Utilisateur'}</p>
              </div>
              <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-md uppercase shrink-0 border border-blue-400/20">
                {user.role}
              </span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-400 hover:bg-red-950/40 hover:text-red-300 border border-transparent hover:border-red-800/40 transition-colors text-sm font-semibold cursor-pointer",
              !sidebarOpen && "lg:justify-center lg:px-0"
            )}
            title={t.menu.logout}
          >
            <LogOut className="h-5 w-5 shrink-0 text-red-400" />
            {(sidebarOpen || window.innerWidth < 1024) && <span>{t.menu.logout}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

