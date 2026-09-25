import { Routes, Route } from 'react-router-dom';
import { LogisticsList } from './LogisticsList';
import { TruckForm } from './TruckForm';
import { DriverForm } from './DriverForm';

export function LogisticsRouter() {
  return (
    <Routes>
      <Route index element={<LogisticsList />} />
      <Route path="truck/new" element={<TruckForm />} />
      <Route path="truck/:id" element={<TruckForm />} />
      <Route path="driver/new" element={<DriverForm />} />
      <Route path="driver/:id" element={<DriverForm />} />
    </Routes>
  );
}
