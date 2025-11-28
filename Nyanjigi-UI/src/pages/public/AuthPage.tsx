import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Droplets, Eye, EyeOff, User, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const AuthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    account_number: '',
    password: ''
  });

  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const credentials = activeTab === 'admin' 
        ? { username: formData.username, password: formData.password }
        : { account_number: formData.account_number, password: formData.password };

      await login(credentials, activeTab);
      addToast('Login successful!', 'success');
      navigate(activeTab === 'admin' ? '/admin' : '/customer');
    } catch (error: any) {
      addToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabVariants = {
    inactive: { 
      opacity: 0.6, 
      scale: 0.95,
      y: 20
    },
    active: { 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    }
  };

  const formVariants = {
    hidden: { 
      opacity: 0, 
      x: activeTab === 'customer' ? -50 : 50,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 300,
        damping: 30
      }
    },
    exit: { 
      opacity: 0, 
      x: activeTab === 'customer' ? 50 : -50,
      scale: 0.95,
      transition: {
        duration: 0.2
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-10 -left-10 w-40 h-40 bg-blue-400/20 rounded-full blur-xl"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute top-1/3 -right-10 w-60 h-60 bg-cyan-400/20 rounded-full blur-xl"
          animate={{ x: [0, -80, 0], y: [0, 80, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute -bottom-10 left-1/3 w-50 h-50 bg-blue-500/20 rounded-full blur-xl"
          animate={{ x: [0, 60, 0], y: [0, -40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
        />
      </div>

      {/* Back to home link */}
      <Link
        to="/"
        className="absolute top-6 left-6 text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-2 transition-colors"
      >
        <Droplets className="h-5 w-5" />
        <span>Back to Home</span>
      </Link>

      {/* Main auth container */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, type: "spring", stiffness: 100 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Glass container */}
        <div className="backdrop-blur-xl bg-white/25 rounded-3xl shadow-2xl border border-white/30 p-8 relative overflow-hidden">
          {/* Logo and title */}
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="flex items-center justify-center mb-4">
              <motion.div
                className="bg-gradient-to-r from-blue-600 to-cyan-600 p-3 rounded-2xl"
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 400 }}
              >
                <Droplets className="h-8 w-8 text-white" />
              </motion.div>
            </div>
            <h1 className="text-2xl font-bold text-blue-900 mb-2">Welcome Back</h1>
            <p className="text-blue-700">Sign in to your account</p>
          </motion.div>

          {/* Tab selector */}
          <motion.div 
            className="flex bg-white/20 rounded-2xl p-1 mb-6 backdrop-blur-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {(['customer', 'admin'] as const).map((tab) => (
              <motion.button
                key={tab}
                className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center space-x-2 ${
                  activeTab === tab
                    ? 'bg-white text-blue-900 shadow-lg'
                    : 'text-blue-700 hover:text-blue-900 hover:bg-white/10'
                }`}
                onClick={() => setActiveTab(tab)}
                variants={tabVariants}
                animate={activeTab === tab ? 'active' : 'inactive'}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {tab === 'customer' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                <span className="capitalize">{tab}</span>
              </motion.button>
            ))}
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-6"
              >
                {/* Username/Account Number field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-900">
                    {activeTab === 'admin' ? 'Username' : 'Account Number'}
                  </label>
                  <motion.input
                    type="text"
                    name={activeTab === 'admin' ? 'username' : 'account_number'}
                    value={activeTab === 'admin' ? formData.username : formData.account_number}
                    onChange={handleInputChange}
                    placeholder={activeTab === 'admin' ? 'Enter username' : 'e.g., NyWs-00001'}
                    className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm text-blue-900 placeholder-blue-600/60"
                    required
                    whileFocus={{ scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  />
                </div>

                {/* Password field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-blue-900">
                    Password
                  </label>
                  <div className="relative">
                    <motion.input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter password"
                      className="w-full px-4 py-3 bg-white/50 border border-white/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm text-blue-900 placeholder-blue-600/60 pr-12"
                      required
                      whileFocus={{ scale: 1.02 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    />
                    <motion.button
                      type="button"
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-600 hover:text-blue-800"
                      onClick={() => setShowPassword(!showPassword)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 px-6 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            >
              {loading ? (
                <motion.div
                  className="flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Signing in...
                </motion.div>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>



          {/* Link to sign up
          <motion.div
            className="mt-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <p className="text-blue-700">
              Don't have an account?{' '}
              <Link
                to="/signup"
                className="text-blue-600 hover:text-blue-800 font-medium underline"
              >
                Sign up here
              </Link>
            </p>
          </motion.div> */}
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;