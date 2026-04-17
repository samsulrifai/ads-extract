import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import DashboardPage from '@/pages/DashboardPage';
import AdsPage from '@/pages/AdsPage';
import EarningsPage from '@/pages/EarningsPage';
import ShopsPage from '@/pages/ShopsPage';
import OrdersPage from '@/pages/OrdersPage';
import CallbackPage from '@/pages/CallbackPage';
import LoginPage from '@/pages/LoginPage';
import MembersPage from '@/pages/MembersPage'; // Will create this next
import ProtectedRoute from '@/components/ProtectedRoute';
import { AuthProvider } from '@/contexts/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/callback" element={<CallbackPage />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/ads" element={<AdsPage />} />
            <Route path="/earnings" element={<EarningsPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/shops" element={<ShopsPage />} />
            {/* Will make this adminOnly later */}
            <Route path="/members" element={<ProtectedRoute adminOnly><MembersPage /></ProtectedRoute>} /> 
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
