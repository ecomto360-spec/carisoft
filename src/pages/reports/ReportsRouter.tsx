import { Routes, Route } from 'react-router-dom';
import { ReportsDashboard } from './ReportsDashboard';
import { TruckDeliveriesReport } from './TruckDeliveriesReport';
import { TruckOnlyDeliveriesReport } from './TruckOnlyDeliveriesReport';
import { PeriodicDeliveriesReport } from './PeriodicDeliveriesReport';

export function ReportsRouter() {
  return (
    <Routes>
      <Route index element={<ReportsDashboard />} />
      <Route path="truck-deliveries" element={<TruckDeliveriesReport />} />
      <Route path="truck-only-deliveries" element={<TruckOnlyDeliveriesReport />} />
      <Route path="periodic-deliveries" element={<PeriodicDeliveriesReport />} />
    </Routes>
  );
}

