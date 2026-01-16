import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  Users, 
  CreditCard, 
  BarChart3, 
  Shield, 
  Smartphone,
  ChevronRight,
  CheckCircle,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';

const IMAGES = {
  hero: "/homepage/nyanjigi b1.jpeg", 
  about: "/homepage/nyanjigi b2.jpeg", 
  logo: "/homepage/logo.jpeg" 
};

const HomePage: React.FC = () => {
  const features = [
    {
      icon: Users,
      title: 'Community Focused',
      description: 'Dedicated to serving the Nyanjigi community with reliable irrigation water.'
    },
    {
      icon: CreditCard,
      title: 'Easy Payments',
      description: 'Pay your bills easily via M-Pesa STK Push or direct Paybill.'
    },
    {
      icon: Shield,
      title: 'Transparent Billing',
      description: 'Clear, accurate monthly billing with instant SMS notifications.'
    },
    {
      icon: BarChart3,
      title: 'Sustainable Growth',
      description: 'Promoting agricultural growth through consistent water supply.'
    }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-gray-800">
      {/* Navigation */}
      <nav className="bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              {/* [FIX 2] Replaced Icon with Logo Image */}
              <div className="h-10 w-10 overflow-hidden rounded-lg">
                <img 
                  src={IMAGES.logo} 
                  alt="Nyanjigi Logo" 
                  className="h-full w-full object-cover" 
                />
              </div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Nyanjigi Irrigation</span>
            </motion.div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-8">
              <a href="#about" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">About</a>
              <a href="#services" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Services</a>
              <a href="#contact" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">Contact</a>
              <Link
                to="/auth"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                Customer Portal
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-[600px] flex items-center">
        <div className="absolute inset-0 z-0">
          <img 
            src={IMAGES.hero} 
            alt="Irrigation Water Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-blue-800/40" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-2xl text-white"
          >
            <span className="inline-block py-1 px-3 rounded-full bg-blue-500/30 border border-blue-400/30 text-blue-100 text-sm font-semibold mb-6 backdrop-blur-sm">
              Sustainable Irrigation Solutions
            </span>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              Empowering Agriculture Through Water
            </h1>
            <p className="text-xl text-blue-100 mb-8 leading-relaxed">
              We provide reliable irrigation water to the Nyanjigi community, ensuring prosperous farming and sustainable growth for every member.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/auth"
                className="bg-white text-blue-900 px-8 py-4 rounded-full font-bold text-lg transition-all hover:bg-blue-50 shadow-lg flex items-center justify-center gap-2"
              >
                Member Login <ChevronRight className="h-5 w-5" />
              </Link>
              <a
                href="#about"
                className="border-2 border-white/30 text-white px-8 py-4 rounded-full font-bold text-lg transition-all hover:bg-white/10 backdrop-blur-sm"
              >
                Learn More
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Who We Are</h2>
              <div className="w-20 h-1.5 bg-blue-600 mb-8 rounded-full"></div>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Nyanjigi Irrigation Water Project is a community-driven initiative committed to transforming agriculture in our region. We manage water distribution, infrastructure maintenance, and sustainable usage policies to ensure every farmer gets their fair share.
              </p>
              <ul className="space-y-4">
                {['Reliable Water Supply', 'Community Managed', 'Transparent Operations'].map((item) => (
                  <li key={item} className="flex items-center text-gray-700">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                    {item}
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-blue-100 rounded-3xl transform rotate-2"></div>
              <img 
                src={IMAGES.about} 
                alt="Community Project" 
                className="relative rounded-2xl shadow-xl w-full object-cover h-[400px]"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services/Features Grid */}
      <section id="services" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Services</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">Providing comprehensive water management solutions tailored for our members.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl hover:border-blue-100 transition-all group"
              >
                <div className="w-14 h-14 bg-blue-50 rounded-xl flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
                  <feature.icon className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold mb-6">Get in Touch</h2>
              <p className="text-blue-200 mb-8 text-lg">
                Have questions about your bill, connection, or membership? Our team is here to help you.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-blue-800 p-3 rounded-lg">
                    <Phone className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Phone</h3>
                    <p className="text-blue-200">+254 117 286375</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-blue-800 p-3 rounded-lg">
                    <Mail className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Email</h3>
                    <p className="text-blue-200">nyanjigi@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-blue-800 p-3 rounded-lg">
                    <MapPin className="h-6 w-6 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Location</h3>
                    <p className="text-blue-200">G3, Iyego-Kangema, Kenya</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-3xl border border-white/10">
              <h3 className="text-2xl font-bold mb-6">Send us a message</h3>
              <form className="space-y-4">
                <input 
                  type="text" 
                  placeholder="Your Name" 
                  className="w-full px-4 py-3 rounded-xl bg-blue-900/50 border border-blue-700 text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <input 
                  type="email" 
                  placeholder="Your Email" 
                  className="w-full px-4 py-3 rounded-xl bg-blue-900/50 border border-blue-700 text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <textarea 
                  rows={4}
                  placeholder="How can we help?" 
                  className="w-full px-4 py-3 rounded-xl bg-blue-900/50 border border-blue-700 text-white placeholder-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                ></textarea>
                <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-colors shadow-lg">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>© {new Date().getFullYear()} Nyanjigi Irrigation Water Project. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;