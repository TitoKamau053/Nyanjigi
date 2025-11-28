const AuthUtils = require('../utils/auth');
const ApiResponse = require('../utils/response');
const { executeQuery } = require('../config/database');

/**
 * Authentication middleware
 */

// Verify admin authentication
const verifyAdmin = async (req, res, next) => {
  try {
    const token = AuthUtils.extractToken(req);
    
    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token is required');
    }

    // Verify token
    const decoded = AuthUtils.verifyToken(token);

    // Check type
    if (decoded.type !== 'admin') {
      return ApiResponse.unauthorized(res, 'Invalid admin token');
    }
    
    // Check if admin exists and is active
    const adminQuery = 'SELECT id, username, email, full_name, is_active FROM admins WHERE id = ? AND is_active = TRUE';
    const admin = await executeQuery(adminQuery, [decoded.id]);
    
    if (!admin || admin.length === 0) {
      return ApiResponse.unauthorized(res, 'Invalid admin account');
    }

    // Update last login
    await executeQuery('UPDATE admins SET last_login = NOW() WHERE id = ?', [decoded.id]);

    // Add admin info to request
    req.admin = admin[0];
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return ApiResponse.unauthorized(res, 'Invalid or expired token');
  }
};

// Verify customer authentication
const verifyCustomer = async (req, res, next) => {
  try {
    const token = AuthUtils.extractToken(req);
    
    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token is required');
    }

    // Verify token
    const decoded = AuthUtils.verifyToken(token);

    // Check type
    if (decoded.type !== 'customer') {
      return ApiResponse.unauthorized(res, 'Invalid customer token');
    }
    
    // Check if customer exists and is active
    const customerQuery = `
      SELECT id, account_number, full_name, phone, email, is_active 
      FROM customers 
      WHERE id = ? AND is_active = TRUE
    `;
    const customer = await executeQuery(customerQuery, [decoded.id]);
    
    if (!customer || customer.length === 0) {
      return ApiResponse.unauthorized(res, 'Invalid customer account');
    }

    // Update last login
    await executeQuery('UPDATE customers SET last_login = NOW() WHERE id = ?', [decoded.id]);

    // Add customer info to request
    req.customer = customer[0];
    next();
  } catch (error) {
    console.error('Customer auth error:', error);
    return ApiResponse.unauthorized(res, 'Invalid or expired token');
  }
};

// Verify token (allows both admin and customer)
const verifyToken = async (req, res, next) => {
  try {
    const token = AuthUtils.extractToken(req);

    if (!token) {
      return ApiResponse.unauthorized(res, 'Access token is required');
    }

    // Verify token
    const decoded = AuthUtils.verifyToken(token);

    // Try to get admin first
    const adminQuery = 'SELECT id, username, email, full_name, is_active FROM admins WHERE id = ? AND is_active = TRUE';
    const admin = await executeQuery(adminQuery, [decoded.id]);

    if (admin && admin.length > 0) {
      // Update last login
      await executeQuery('UPDATE admins SET last_login = NOW() WHERE id = ?', [decoded.id]);

      // Add admin info to request
      req.admin = admin[0];
      req.userType = 'admin';
      req.user = admin[0];
      next();
    } else {
      // Try customer
      const customerQuery = `
        SELECT id, account_number, full_name, phone, email, is_active
        FROM customers
        WHERE id = ? AND is_active = TRUE
      `;
      const customer = await executeQuery(customerQuery, [decoded.id]);

      if (customer && customer.length > 0) {
        // Update last login
        await executeQuery('UPDATE customers SET last_login = NOW() WHERE id = ?', [decoded.id]);

        // Add customer info to request
        req.customer = customer[0];
        req.userType = 'customer';
        req.user = customer[0];
        next();
      } else {
        return ApiResponse.unauthorized(res, 'Invalid user account');
      }
    }
  } catch (error) {
    console.error('Token verification error:', error);
    return ApiResponse.unauthorized(res, 'Invalid or expired token');
  }
};

// Optional authentication (for public endpoints that can benefit from user context)
const optionalAuth = async (req, res, next) => {
  try {
    const token = AuthUtils.extractToken(req);

    if (token) {
      const decoded = AuthUtils.verifyToken(token);

      // Try to get admin first
      const adminQuery = 'SELECT id, username, full_name FROM admins WHERE id = ? AND is_active = TRUE';
      const admin = await executeQuery(adminQuery, [decoded.id]);

      if (admin && admin.length > 0) {
        req.admin = admin[0];
        req.userType = 'admin';
      } else {
        // Try customer
        const customerQuery = 'SELECT id, account_number, full_name FROM customers WHERE id = ? AND is_active = TRUE';
        const customer = await executeQuery(customerQuery, [decoded.id]);

        if (customer && customer.length > 0) {
          req.customer = customer[0];
          req.userType = 'customer';
        }
      }
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    next();
  }
};

module.exports = {
  verifyAdmin,
  verifyCustomer,
  verifyToken,
  optionalAuth
};
