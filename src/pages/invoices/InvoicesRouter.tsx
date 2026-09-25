import { Routes, Route } from 'react-router-dom';
import { InvoiceList } from './InvoiceList';

export function InvoicesRouter() {
  return (
    <Routes>
      <Route index element={<InvoiceList />} />
    </Routes>
  );
}
