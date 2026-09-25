import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { OrderNotificationWatcher } from '../notifications/OrderNotificationWatcher';
import { NotificationToast } from '../notifications/NotificationToast';
import { DemoModeBanner } from '../demo/DemoModeBanner';
import { FloatingAnomalyButton } from '../demo/FloatingAnomalyButton';
import { AnomalyReportModal } from '../demo/AnomalyReportModal';
import { AnomalyListModal } from '../demo/AnomalyListModal';

export function Layout() {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Real-time Order Notification Watcher */}
      <OrderNotificationWatcher />

      {/* Floating Order Notification Banner */}
      <NotificationToast />

      {/* Anomaly & Bug reporting Modals */}
      <AnomalyReportModal />
      <AnomalyListModal />

      {/* Floating Anomaly Button for client testing */}
      <FloatingAnomalyButton />

      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Active Demo Mode Banner */}
        <DemoModeBanner />
        <Header />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 pb-24 lg:pb-6">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
        <MobileBottomNav />
      </div>
    </div>
  );
}

