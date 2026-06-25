import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { LangProvider } from './i18n/LangContext';
import { Layout } from './components/Layout/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { InventoryPage } from './pages/InventoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { DebtsPage } from './pages/DebtsPage';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

const ManagerRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const user = useAuthStore(s => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'manager') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

function App() {
  const load = useSettingsStore(s => s.load);
  useEffect(() => { load(); }, [load]);

  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="checkout"  element={<CheckoutPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="reports"   element={<ReportsPage />} />
            <Route path="users"     element={<AdminRoute><UsersPage /></AdminRoute>} />
            <Route path="settings"  element={<SettingsPage />} />
            <Route path="expenses"  element={<ManagerRoute><ExpensesPage /></ManagerRoute>} />
            <Route path="debts"     element={<ManagerRoute><DebtsPage /></ManagerRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}

export default App;
