import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { AdminLayout } from './layouts/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { FoundationPlaceholderPage } from './pages/FoundationPlaceholderPage';
import { OperationsPage } from './pages/Operations';
import UsersPage from './pages/Users'; import RolesPage from './pages/Roles'; import PartnersPage from './pages/Partners'; import ContractsPage from './pages/Contracts'; import ServicesPage from './pages/Services';
import TrackingPage from './pages/TrackingPage';
import GoodsPage from './pages/GoodsPage';
import ConfirmationsPage from './pages/ConfirmationsPage';
import FinancePage from './pages/FinancePage';
import ReportsPage from './pages/ReportsPage';
import VehicleQrInfoPage from './pages/VehicleQrInfoPage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff', borderRadius: 8 } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/vehicle-qr" element={<VehicleQrInfoPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/operations" element={<OperationsPage />} />
              <Route path="/tracking" element={<TrackingPage />} />
              <Route path="/goods" element={<GoodsPage />} />
              <Route path="/confirmations" element={<ConfirmationsPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/partners" element={<PartnersPage />} />
              <Route path="/contracts" element={<ContractsPage />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/settings" element={<FoundationPlaceholderPage />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  </AuthProvider>,
);
