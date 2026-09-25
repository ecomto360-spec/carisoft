import { Routes, Route } from 'react-router-dom';
import { UserList } from './UserList';
import { UserForm } from './UserForm';

export function UsersRouter() {
  return (
    <Routes>
      <Route index element={<UserList />} />
      <Route path="new" element={<UserForm />} />
      <Route path=":id" element={<UserForm />} />
    </Routes>
  );
}
