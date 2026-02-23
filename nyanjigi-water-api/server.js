const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import configurations and middleware
const { testConnection } = require('./config/database');
const { globalErrorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');
const SchedulerService = require('./services/SchedulerService');

// Initialize Express app
const app = express();

// ===== SECURITY MIDDLEWARE =====

// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hidePoweredBy: true
}));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://nyanjigi.online', 'https://www.nyanjigi.online', 'https://api.nyanjigi.online']
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: (parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retry_after: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW) || 15) * 60)
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and webhooks
    return req.path === '/api/v1/health' || 
           req.path === '/api/v1/payments/jenga-callback';
  }
});
app.use('/api/', limiter);

// ===== GENERAL MIDDLEWARE =====

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined'));
} else {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    if (req.path === '/api/v1/payments/jenga-callback') {
      req.rawBody = buf;
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
// Serve static files from public directory
app.use(express.static('public'));

// Trust proxy for accurate IP addresses (if behind reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// API Routes
app.use('/api/v1', routes);

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// API Documentation placeholder
app.get('/api/v1/docs', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json({
    message: 'API Documentation',
    version: '1.0.0',
    endpoints: {
      authentication: {
        'POST /auth/admin/login': 'Admin login',
        'POST /auth/customer/login': 'Customer login',
        'GET /auth/admin/profile': 'Get admin profile',
        'GET /auth/customer/profile': 'Get customer profile'
      },
      customers: {
        'POST /customers': 'Create customer (Admin)',
        'GET /customers': 'Get all customers (Admin)',
        'GET /customers/:id': 'Get customer details',
        'PUT /customers/:id': 'Update customer'
      },
      bills: {
        'POST /bills/generate': 'Generate monthly bills',
        'GET /bills': 'Get all bills',
        'GET /bills/:id': 'Get bill details',
        'PUT /bills/:id/status': 'Update bill status'
      },
      payments: {
        'POST /payments/stk-push': 'Initiate STK Push payment',
        'POST /payments/jenga-callback': 'Jenga API callback',
        'GET /payments': 'Get all payments',
        'GET /payments/:id': 'Get payment details'
      },
      contributions: {
        'POST /contributions/generate': 'Generate contributions',
        'GET /contributions': 'Get all contributions',
        'PUT /contributions/amount': 'Update contribution amount'
      },
      settings: {
        'GET /settings': 'Get all settings',
        'PUT /settings/billing/config': 'Update billing settings',
        'PUT /settings/payments/config': 'Update payment settings'
      }
    },
    authentication: 'Bearer Token (JWT)',
    support: 'support@nyanjigi.co.ke'
  });
});

// ===== ERROR HANDLING =====

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// ===== SERVER STARTUP =====

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Graceful shutdown handling
const server = app.listen(PORT,'0.0.0.0', async () => {
  console.log('Nyanjigi Waters Management System API');
  console.log('='.repeat(50));
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${NODE_ENV}`);
  console.log(`API Base URL: http://localhost:${PORT}/api/v1`);
  console.log(`Documentation: http://localhost:${PORT}/api/v1/docs`);
  
  // Test database connection
  try {
    await testConnection();
    console.log('Database connection successful');

    try {
      await SchedulerService.initialize();
      SchedulerService.startAll();
      console.log('Scheduler jobs initialized');
    } catch (schedulerError) {
      console.error('Scheduler initialization failed:', schedulerError.message);
    }
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
  
  console.log('='.repeat(50));
  console.log('🎯 Ready to accept requests!');
  
  if (NODE_ENV === 'development') {
    console.log('\nDevelopment URLs:');
    console.log(`   Health Check: http://localhost:${PORT}/api/v1/health`);
    console.log(`   Admin Login:  POST http://localhost:${PORT}/api/v1/auth/admin/login`);
    console.log(`   Customer Login: POST http://localhost:${PORT}/api/v1/auth/customer/login`);
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
  await SchedulerService.shutdown().catch(err => console.error('Scheduler shutdown failed:', err.message));
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('\n🛑 SIGINT received. Shutting down gracefully...');
  await SchedulerService.shutdown().catch(err => console.error('Scheduler shutdown failed:', err.message));
  server.close(() => {
    console.log('✅ Server closed successfully');
    process.exit(0);
  });
});

// Unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;