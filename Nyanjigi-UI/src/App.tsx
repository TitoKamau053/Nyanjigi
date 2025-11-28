import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import HomePage from './pages/public/HomePage';
import AuthPage from './pages/public/AuthPage';
import AdminLayout from './components/layout/AdminLayout';
import CustomerLayout from './components/layout/CustomerLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import CustomerManagement from './pages/admin/CustomerManagement';
import BillingManagement from './pages/admin/BillingManagement';
import PaymentManagement from './pages/admin/PaymentManagement';
import ContributionManagement from './pages/admin/ContributionManagement';
import SystemSettings from './pages/admin/SystemSettings';
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CustomerBills from './pages/customer/CustomerBills';
import CustomerPayments from './pages/customer/CustomerPayments';
import CustomerProfile from './pages/customer/CustomerProfile';
import CustomerContributions from './pages/customer/CustomerContributions';
import CustomerFines from './pages/customer/CustomerFines';
import AdminFines from './pages/admin/AdminFines';
import NotificationManagement from './pages/admin/NotificationManagement';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthPage />} />
              
              {/* Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="customers" element={<CustomerManagement />} />
                <Route path="billing" element={<BillingManagement />} />
                <Route path="payments" element={<PaymentManagement />} />
                <Route path="contributions" element={<ContributionManagement />} />
                <Route path="fines" element={<AdminFines />} />
                <Route path="notifications" element={<NotificationManagement />} />
                <Route path="settings" element={<SystemSettings />} />
              </Route>

              {/* Customer Routes */}
              <Route path="/customer" element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <CustomerLayout />
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/customer/dashboard" replace />} />
                <Route path="dashboard" element={<CustomerDashboard />} />
                <Route path="bills" element={<CustomerBills />} />
                <Route path="payments" element={<CustomerPayments />} />
                <Route path="profile" element={<CustomerProfile />} />
                <Route path="contributions" element={<CustomerContributions />} />
                <Route path="fines" element={<CustomerFines />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
