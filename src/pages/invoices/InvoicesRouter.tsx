import { Routes, Route } from 'react-router-dom';
import { InvoiceList } from './InvoiceList';
import { InvoiceForm } from './InvoiceForm';

export function InvoicesRouter() {
  return (
    <Routes>
      <Route index element={<InvoiceList />} />
      <Route path="new" element={<InvoiceForm />} />
      <Route path=":id" element={<InvoiceForm />} />
      <Route path=":id/edit" element={<InvoiceForm />} />
    </Routes>
  );
}
