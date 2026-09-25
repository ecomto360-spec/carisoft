import { Routes, Route } from 'react-router-dom';
import { DeliveryList } from './DeliveryList';
import { DeliveryForm } from './DeliveryForm';

export function DeliveriesRouter() {
  return (
    <Routes>
      <Route index element={<DeliveryList />} />
      <Route path="new" element={<DeliveryForm />} />
      <Route path=":id" element={<DeliveryForm />} />
    </Routes>
  );
}
