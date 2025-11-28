const express = require('express');

// Import route modules
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const customerRoutes = require('./customers');

const billRoutes = require('./bills');
const paymentRoutes = require('./payments');
const contributionRoutes = require('./contributions');
const settingsRoutes = require('./settings');
const finesRoutes = require('./fines');
const equityRoutes = require('./equity');

const router = express.Router();

/**
 * API Routes Configuration
 * Base path: /api/v1
 */

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'Nyanjigi Waters Management System API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Information endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'Nyanjigi Waters Management System API',
    version: '1.0.0',
    description: 'Water billing and management system, developed by Titus Kamau',
    endpoints: {
      authentication: '/api/v1/auth',
      admin: '/api/v1/admin',
      customers: '/api/v1/customers',
      bills: '/api/v1/bills',
      payments: '/api/v1/payments',
      contributions: '/api/v1/contributions',
      settings: '/api/v1/settings'
    },
    features: [
      'Customer Management',
      'Automated Billing',
      'Jenga STK Push Integration',
      'Monthly Contributions',
      'Real-time Analytics',
      'System Configuration'
    ],
    documentation: '/api/v1/docs',
    support: {
      email: 'titusmainakamau053@gmail.com',
      phone: '+2547048499289'
    }
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/customers', customerRoutes);
router.use('/bills', billRoutes);
router.use('/equity', equityRoutes); 
router.use('/payments', paymentRoutes);
router.use('/contributions', contributionRoutes);
router.use('/settings', settingsRoutes);
router.use('/fines', finesRoutes);


module.exports = router;