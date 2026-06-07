import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const IMAGES = {
  bg: "/homepage/nyanjigi b1.jpeg",
  logo: "/homepage/logo.jpeg"
};

const AuthPage: React.FC = () => {
  // Default to 'customer', 'admin' is hidden
  const [activeTab, setActiveTab] = useState<'customer' | 'admin'>('customer');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Secret counter for enabling admin mode
  const [secretClickCount, setSecretClickCount] = useState(0);

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

  // Click Logo 3 times to toggle Admin Mode
  const handleSecretClick = () => {
    setSecretClickCount(prev => {
      const newCount = prev + 1;
      if (newCount === 3) {
        const newTab = activeTab === 'customer' ? 'admin' : 'customer';
        setActiveTab(newTab);
        addToast(
          newTab === 'admin' ? 'Admin Access Enabled' :'Returned to Member Login', 
          newTab === 'admin' ? 'success' : 'info'
        );
        return 0; // Reset counter
      }
      return newCount;
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
      addToast(`Welcome back!`, 'success');
      navigate(activeTab === 'admin' ? '/admin' : '/customer');
    } catch (error: any) {
      addToast(error.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col md:flex-row">
      
      <div className="hidden md:flex md:w-1/2 bg-blue-900 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 z-0 opacity-40">
           <img 
            src={IMAGES.bg} 
            alt="Background" 
            className="w-full h-full object-cover"
           />
           <div className="absolute inset-0 bg-blue-900/60" />
        </div>
        
        <div className="relative z-10 text-white max-w-lg">
          <div className="mb-8">
            <div className="bg-white/20 p-4 rounded-2xl w-fit backdrop-blur-md border border-white/10 mb-6">
              <img 
                src={IMAGES.logo} 
                alt="Nyanjigi Logo" 
                className="h-16 w-16 object-contain rounded-lg"
              />
            </div>
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Manage Your Water Account
            </h1>
            <p className="text-blue-100 text-lg leading-relaxed mb-8">
              Access your monthly bills, payment history, and usage statistics in one secure portal.
            </p>
            
            {/* Feature List */}
            <div className="space-y-4">
              {['Secure Payments', 'Instant Notifications', 'Usage Analytics'].map((item) => (
                <div key={item} className="flex items-center space-x-3 text-blue-50">
                  <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8 bg-gray-50/50">
        <div className="w-full max-w-md space-y-8 bg-white p-10 rounded-3xl shadow-xl border border-gray-100">
          
          {/* Logo & Secret Trigger Area */}
          <div className="flex flex-col items-center mb-8">
             <motion.button
               whileHover={{ scale: 1.05 }}
               whileTap={{ scale: 0.95 }}
               onClick={handleSecretClick}
               className={`p-2 rounded-2xl mb-4 transition-all duration-300 ${
                 activeTab === 'admin' 
                   ? 'bg-red-50 ring-2 ring-red-100' 
                   : 'bg-transparent'
               }`}
               title="Click 3 times for Admin"
             >
               {activeTab === 'admin' ? (
                 <Lock className="h-16 w-16 text-red-600 p-2" />
               ) : (
                 /* Using local logo as the trigger button */
                 <img 
                   src={IMAGES.logo} 
                   alt="Nyanjigi Logo" 
                   className="h-20 w-20 object-contain rounded-xl"
                 />
               )}
             </motion.button>
             
             <h2 className="text-3xl font-bold text-gray-900">
               {activeTab === 'admin' ? 'Admin Access' : 'Member Login'}
             </h2>
             <p className="mt-2 text-gray-500 text-center">
               {activeTab === 'admin' 
                 ? 'Restricted area. Authorized personnel only.' 
                 : 'Welcome back! Please enter your details.'}
             </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 ml-1">
                    {activeTab === 'admin' ? 'Username' : 'Account Number'}
                  </label>
                  <input
                    type="text"
                    name={activeTab === 'admin' ? 'username' : 'account_number'}
                    value={activeTab === 'admin' ? formData.username : formData.account_number}
                    onChange={handleInputChange}
                    placeholder={activeTab === 'admin' ? 'Enter admin username' : 'e.g., NyWs-001'}
                    className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400"
                    required
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2 ml-1">
                    <label className="block text-sm font-semibold text-gray-700">
                      Password
                    </label>
                    {activeTab === 'customer' && (
                      <Link to="/" className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors">
                        Forgot Password?
                      </Link>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter your password"
                      className="w-full px-5 py-4 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none text-gray-900 placeholder-gray-400 pr-12"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg shadow-blue-900/10 transition-all ${
                activeTab === 'admin' 
                  ? 'bg-gray-900 hover:bg-gray-800' 
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying...</span>
                </div>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Sign In <ArrowRight className="h-5 w-5" />
                </span>
              )}
            </motion.button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <Link to="/" className="inline-flex items-center text-gray-500 hover:text-blue-600 text-sm font-medium transition-colors group">
              <ArrowRight className="h-4 w-4 mr-2 rotate-180 group-hover:-translate-x-1 transition-transform" />
              Back to Home Website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;