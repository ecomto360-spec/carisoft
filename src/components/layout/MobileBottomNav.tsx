import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Plus, Receipt, Menu } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../i18n';

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleSidebar } = useAppStore();
  const { t } = useTranslation();

  const isHome = location.pathname === '/';
  const isDeliveries = location.pathname.startsWith('/deliveries') && location.pathname !== '/deliveries/new';
  const isInvoices = location.pathname.startsWith('/invoices') && location.pathname !== '/invoices/new';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-300 py-1.5 px-3 shadow-2xl safe-area-pb">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        
        {/* Accueil / Dashboard */}
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors text-center min-w-[54px]",
            isHome ? "text-blue-400 font-bold" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">{t.menu.dashboard.split(' ')[0]}</span>
        </Link>

        {/* Bons BL */}
        <Link
          to="/deliveries"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors text-center min-w-[54px]",
            isDeliveries ? "text-blue-400 font-bold" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <FileText className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">{t.deliveries.ptcShort} BL</span>
        </Link>

        {/* Action Button: Nouveau BL / Pesée (Raised Center Button) */}
        <button
          onClick={() => navigate('/deliveries/new')}
          className="flex flex-col items-center justify-center -mt-5 cursor-pointer group"
          title={t.deliveries.newDelivery}
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 to-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 border-4 border-slate-900 group-active:scale-95 transition-transform">
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold text-blue-400 mt-0.5">{t.deliveries.newDelivery.split(' ')[0]}</span>
        </button>

        {/* Facturation */}
        <Link
          to="/invoices"
          className={cn(
            "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-colors text-center min-w-[54px]",
            isInvoices ? "text-blue-400 font-bold" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <Receipt className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">{t.menu.invoices}</span>
        </Link>

        {/* Menu Plus */}
        <button
          onClick={toggleSidebar}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-400 hover:text-slate-200 transition-colors text-center min-w-[54px] cursor-pointer"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] mt-0.5">Menu</span>
        </button>

      </div>
    </nav>
  );
}
