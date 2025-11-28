const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validationResult } = require('express-validator');

// Protect routes - General authentication
const protect = async (req, res, next) => {
  let token;

  // Check for token in headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Not authorized to access this route' }
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Add user info to request
    req.user = {
      id: decoded.id,
      role: decoded.role,
      type: decoded.type // 'admin' or 'customer'
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Not authorized to access this route' }
    });
  }
};

// Admin only routes
const adminOnly = async (req, res, next) => {
  if (!req.user || req.user.type !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied. Admin privileges required' }
    });
  }
  next();
};

// Customer only routes
const customerOnly = async (req, res, next) => {
  if (!req.user || req.user.type !== 'customer') {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied. Customer access only' }
    });
  }
  next();
};

// Verify customer owns the resource
const verifyCustomerAccess = async (req, res, next) => {
  try {
    const customerId = req.params.customerId || req.body.customer_id;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Customer ID required' }
      });
    }

    // If user is admin, allow access
    if (req.user.type === 'admin') {
      return next();
    }

    // If user is customer, verify they own the resource
    if (req.user.type === 'customer' && req.user.id == customerId) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: { message: 'Access denied. You can only access your own data' }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: { message: 'Server error during access verification' }
    });
  }
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Handle validation errors from express-validator
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors.array()
      }
    });
  }
  next();
};

// 404 Not Found handler
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Global error handler
const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};

module.exports = {
  protect,
  adminOnly,
  customerOnly,
  verifyCustomerAccess,
  asyncHandler,
  handleValidationErrors,
  notFoundHandler,
  globalErrorHandler
};
