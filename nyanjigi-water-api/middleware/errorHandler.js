//
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { validationResult } = require('express-validator');

// Protect routes - General authentication
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: { message: 'Not authorized to access this route' }
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      type: decoded.type
    };
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { message: 'Not authorized to access this route' }
    });
  }
};

const adminOnly = async (req, res, next) => {
  if (!req.user || req.user.type !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied. Admin privileges required' }
    });
  }
  next();
};

const customerOnly = async (req, res, next) => {
  if (!req.user || req.user.type !== 'customer') {
    return res.status(403).json({
      success: false,
      error: { message: 'Access denied. Customer access only' }
    });
  }
  next();
};

const verifyCustomerAccess = async (req, res, next) => {
  try {
    const customerId = req.params.customerId || req.body.customer_id;
    
    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Customer ID required' }
      });
    }

    if (req.user.type === 'admin') {
      return next();
    }

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

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

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
  //Explicitly set the status code property on the error object
  error.statusCode = 404; 
  next(error);
};

// Global error handler
const globalErrorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Correctly determine status code (use err.statusCode if available)
  const statusCode = err.statusCode || 500;

  // Only log ACTUAL server errors (500). This silence logs for 404s (bots) and 400s (validation errors).
  if (statusCode === 500) {
    console.error('SERVER ERROR:', err);
  }

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

  res.status(statusCode).json({
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