import { Routes, Route } from 'react-router-dom';
import { ProductList } from './ProductList';
import { ProductForm } from './ProductForm';

export function ProductsRouter() {
  return (
    <Routes>
      <Route index element={<ProductList />} />
      <Route path="new" element={<ProductForm />} />
      <Route path=":id" element={<ProductForm />} />
    </Routes>
  );
}
