import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Droplets, 
  Users, 
  CreditCard, 
  BarChart3, 
  Shield, 
  Smartphone,
  ChevronRight,
  CheckCircle
} from 'lucide-react';

const HomePage: React.FC = () => {
  const features = [
    {
      icon: Users,
      title: 'Customer Management',
      description: 'Comprehensive customer database with account management'
    },
    {
      icon: CreditCard,
      title: 'Billing & Payments',
      description: 'Automated billing with M-Pesa STK Push integration'
    },
    {
      icon: BarChart3,
      title: 'Analytics & Reports',
      description: 'Real-time analytics and financial reporting'
    },
    {
      icon: Shield,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security with 99.9% uptime'
    }
  ];

  const benefits = [
    'Automated monthly billing generation',
    'Real-time payment processing',
    'Customer portal access',
    'Mobile-friendly interface',
    'Comprehensive reporting',
    'Multi-user access control'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100">
      {/* Navigation */}
      <nav className="backdrop-blur-md bg-white/10 border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <motion.div 
              className="flex items-center space-x-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Droplets className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-blue-900">Nyanjigi Irrigation Water Project</span>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <Link
                to="/auth"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                Login
              </Link>
            </motion.div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-cyan-600/20"></div>
        <div className="relative max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-8"
            >
              <h1 className="text-5xl lg:text-6xl font-bold text-blue-900 leading-tight">
                Modern Water
                <span className="text-blue-600"> Management</span>
                <br />
                Made Simple
              </h1>
              
              <p className="text-xl text-blue-700 leading-relaxed max-w-xl">
                Streamline your water utility operations with our comprehensive management system. 
                From billing to payments, everything you need in one place.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  to="/auth"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center"
                >
                  Get Started
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Link>
                
                <button className="border border-blue-300 text-blue-700 hover:bg-blue-50 px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200">
                  Learn More
                </button>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="aspect-w-4 aspect-h-3 rounded-2xl overflow-hidden shadow-2xl">
                <img
                  src="https://images.pexels.com/photos/615326/water-tap-black-and-white-macro-615326.jpeg"
                  alt="Water tap close-up"
                  className="w-full h-96 object-cover rounded-2xl"
                />

              </div>
              <div className="absolute -top-4 -right-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
                <div className="flex items-center space-x-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">System Active</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-blue-900 mb-4">
              Everything You Need to Manage Water Services
            </h2>
            <p className="text-xl text-blue-700 max-w-3xl mx-auto">
              Our comprehensive platform provides all the tools necessary to efficiently manage 
              your water utility operations from customer registration to payment processing.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="backdrop-blur-md bg-white/20 rounded-2xl p-8 border border-white/30 hover:bg-white/30 transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                <div className="bg-blue-600 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-blue-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-blue-700">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600/10 to-cyan-600/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <img
                  src="https://images.pexels.com/photos/615326/water-tap-black-and-white-macro-615326.jpeg"
                  alt="Water tap close-up"
                  className="w-full h-96 object-cover rounded-2xl"
                />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-4xl font-bold text-blue-900 mb-6">
                  Why Choose Our Platform?
                </h2>
                <p className="text-xl text-blue-700">
                  Built specifically for water utilities, our platform offers comprehensive 
                  features that streamline operations and improve customer satisfaction.
                </p>
              </div>

              <div className="space-y-4">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={benefit}
                    initial={{ opacity: 0, x: 40 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className="flex items-center space-x-3"
                  >
                    <CheckCircle className="h-6 w-6 text-green-600 flex-shrink-0" />
                    <span className="text-blue-800 font-medium">{benefit}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
<section className="py-20 px-4">
  <div className="max-w-4xl mx-auto text-center">
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="backdrop-blur-md bg-gradient-to-r from-blue-600/20 to-cyan-600/20 rounded-3xl p-12 border border-white/30"
    >
      <h2 className="text-4xl font-bold text-blue-900 mb-6">
        Join Nyanjigi Irrigation Water Project
      </h2>
      <p className="text-xl text-blue-700 mb-8 max-w-2xl mx-auto">
        Join a reliable, transparent water supplier. Get in touch with us for more information.
      </p>

      {/* WhatsApp Button */}
      <a
        href="https://wa.me/254748499289" 
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center bg-green-600 hover:bg-green-700
         text-white px-8 py-4 rounded-lg font-semibold text-lg 
         transition-all duration-200 shadow-lg hover:shadow-xl mr-4"
      >
        <Smartphone className="mr-2 h-6 w-6" />
        WhatsApp
      </a>

      {/* Phone Dialer Button */}
      <a
        href="tel:+254748499289" 
        className="inline-flex items-center bg-blue-600 hover:bg-blue-700
         text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all
          duration-200 shadow-lg hover:shadow-xl"
      >
        <Smartphone className="mr-2 h-6 w-6" />
        Call Us
      </a>
    </motion.div>
  </div>
</section>


      {/* Footer */}
      <footer className="bg-blue-900 text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Droplets className="h-8 w-8 text-blue-400" />
            <span className="text-xl font-bold">Nyanjigi Irrigation Water Project</span>
          </div>
          <p className="text-blue-300">
            © {new Date().getFullYear()} Nyanjigi Irrigation Water Project. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;