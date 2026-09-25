import { Routes, Route } from 'react-router-dom';
import { OrderList } from './OrderList';
import { OrderForm } from './OrderForm';

export function OrdersRouter() {
  return (
    <Routes>
      <Route index element={<OrderList />} />
      <Route path="new" element={<OrderForm />} />
      <Route path=":id" element={<OrderForm />} />
    </Routes>
  );
}
