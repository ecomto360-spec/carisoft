import { Routes, Route } from 'react-router-dom';
import { PaymentList } from './PaymentList';
import { PaymentForm } from './PaymentForm';

export function PaymentsRouter() {
  return (
    <Routes>
      <Route index element={<PaymentList />} />
      <Route path="new" element={<PaymentForm />} />
      <Route path=":id" element={<PaymentForm />} />
    </Routes>
  );
}
