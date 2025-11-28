import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Droplets,
  LayoutDashboard,
  FileText,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const CustomerLayout: React.FC = () => {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setSidebarOpen(isDesktop);
  }, [isDesktop]);

  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    addToast('Logged out successfully', 'success');
    navigate('/');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/customer/dashboard' },
    { icon: FileText, label: 'Bills', path: '/customer/bills' },
    { icon: CreditCard, label: 'Payments', path: '/customer/payments' },
    { icon: FileText, label: 'Contributions', path: '/customer/contributions' },
    { icon: AlertCircle, label: 'Fines', path: '/customer/fines' },
    { icon: User, label: 'Profile', path: '/customer/profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 flex">
      {/* Mobile menu overlay */}
      {sidebarOpen && !isDesktop && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : -280 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 h-full w-72 lg:w-64 
                   bg-white/20 backdrop-blur-xl border-r border-white/30 z-50"
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-white/20">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-2 rounded-xl">
                <Droplets className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-blue-900">Nyanjigi Waters</h1>
                <p className="text-xs text-blue-600">Customer Portal</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    onClick={() => !isDesktop && setSidebarOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'text-blue-700 hover:bg-white/30'
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          {/* User info */}
          <div className="p-4 border-t border-white/20">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-sm font-bold">
                  {user?.full_name?.charAt(0) || 'C'}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">{user?.full_name}</p>
                <p className="text-xs text-blue-600">{user?.account_number}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 w-full px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Top bar */}
        <header className="bg-white/20 backdrop-blur-xl border-b border-white/30 p-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 text-blue-600 hover:bg-white/20 rounded-lg"
            >
              <Menu className="h-6 w-6" />
            </button>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-blue-900">Welcome back,</p>
                <p className="text-lg font-bold text-blue-700">{user?.full_name}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Close button for mobile sidebar */}
      {sidebarOpen && !isDesktop && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setSidebarOpen(false)}
          className="fixed top-4 right-4 z-50 p-2 bg-white/20 backdrop-blur-xl rounded-lg border border-white/30 text-blue-600 lg:hidden"
        >
          <X className="h-6 w-6" />
        </motion.button>
      )}
    </div>
  );
};

export default CustomerLayout;
