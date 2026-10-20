import { Routes, Route } from 'react-router-dom';
import { ReportsDashboard } from './ReportsDashboard';
import { TruckDeliveriesReport } from './TruckDeliveriesReport';
import { TruckOnlyDeliveriesReport } from './TruckOnlyDeliveriesReport';
import { ProductDeliveriesReport } from './ProductDeliveriesReport';
import { PeriodicDeliveriesReport } from './PeriodicDeliveriesReport';
import { Etat104Report } from './Etat104Report';

export function ReportsRouter() {
  return (
    <Routes>
      <Route index element={<ReportsDashboard />} />
      <Route path="etat-104" element={<Etat104Report />} />
      <Route path="truck-deliveries" element={<TruckDeliveriesReport />} />
      <Route path="truck-only-deliveries" element={<TruckOnlyDeliveriesReport />} />
      <Route path="product-deliveries" element={<ProductDeliveriesReport />} />
      <Route path="periodic-deliveries" element={<PeriodicDeliveriesReport />} />
    </Routes>
  );
}

