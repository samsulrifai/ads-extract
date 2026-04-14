import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import ShopsPage from '@/pages/ShopsPage';
import OrdersPage from '@/pages/OrdersPage';
import CallbackPage from '@/pages/CallbackPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/shops" element={<ShopsPage />} />
          <Route path="/callback" element={<CallbackPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
