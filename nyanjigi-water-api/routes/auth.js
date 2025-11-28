const express = require('express');
const { AdminController, CustomerController } = require('../controllers');
const { verifyAdmin, verifyCustomer } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const ValidationSchemas = require('../utils/validation');

const router = express.Router();

/**
 * Authentication Routes
 * Base path: /api/v1/auth
 */

// ===== ADMIN AUTHENTICATION =====

/**
 * @route   POST /api/v1/auth/admin/login
 * @desc    Admin login
 * @access  Public
 */
router.post('/admin/login',
  ValidationSchemas.adminLogin,
  handleValidationErrors,
  asyncHandler(AdminController.login)
);

/**
 * @route   GET /api/v1/auth/admin/profile
 * @desc    Get admin profile
 * @access  Private (Admin)
 */
router.get('/admin/profile',
  verifyAdmin,
  asyncHandler(AdminController.getProfile)
);

/**
 * @route   PUT /api/v1/auth/admin/profile
 * @desc    Update admin profile
 * @access  Private (Admin)
 */
router.put('/admin/profile',
  verifyAdmin,
  ValidationSchemas.updateAdminProfile,
  handleValidationErrors,
  asyncHandler(AdminController.updateProfile)
);

/**
 * @route   POST /api/v1/auth/admin/change-password
 * @desc    Change admin password
 * @access  Private (Admin)
 */
router.post('/admin/change-password',
  verifyAdmin,
  ValidationSchemas.changePassword,
  handleValidationErrors,
  asyncHandler(AdminController.changePassword)
);

// ===== CUSTOMER AUTHENTICATION =====

/**
 * @route   POST /api/v1/auth/customer/login
 * @desc    Customer login
 * @access  Public
 */
router.post('/customer/login',
  ValidationSchemas.customerLogin,
  handleValidationErrors,
  asyncHandler(CustomerController.login)
);

/**
 * @route   GET /api/v1/auth/customer/profile
 * @desc    Get customer profile
 * @access  Private (Customer)
 */
router.get('/customer/profile',
  verifyCustomer,
  asyncHandler(CustomerController.getProfile)
);

/**
 * @route   PUT /api/v1/auth/customer/profile
 * @desc    Update customer profile (limited fields)
 * @access  Private (Customer)
 */
router.put('/customer/profile',
  verifyCustomer,
  [
    ValidationSchemas.updateCustomer[1], // phone validation
    ValidationSchemas.updateCustomer[2]  // email validation
  ],
  handleValidationErrors,
  asyncHandler(CustomerController.updateProfile)
);

/**
 * @route   POST /api/v1/auth/customer/change-password
 * @desc    Change customer password
 * @access  Private (Customer)
 */
router.post('/customer/change-password',
  verifyCustomer,
  ValidationSchemas.changePassword,
  handleValidationErrors,
  asyncHandler(CustomerController.changePassword)
);

/**
 * @route   GET /api/v1/auth/customer/dashboard
 * @desc    Get customer dashboard data
 * @access  Private (Customer)
 */
router.get('/customer/dashboard',
  verifyCustomer,
  asyncHandler(CustomerController.getDashboard)
);

// ===== TOKEN VALIDATION =====

/**
 * @route   GET /api/v1/auth/validate
 * @desc    Validate JWT token and return user info
 * @access  Private (Admin or Customer)
 */
router.get('/validate', asyncHandler(async (req, res) => {
  const { verifyAdmin, verifyCustomer } = require('../middleware/auth');
  const ApiResponse = require('../utils/response');

  // Try admin authentication first
  verifyAdmin(req, res, (adminErr) => {
    if (!adminErr && req.admin) {
      return ApiResponse.success(res, {
        user_type: 'admin',
        user: req.admin,
        valid: true
      }, 'Token is valid');
    }

    // Try customer authentication
    verifyCustomer(req, res, (customerErr) => {
      if (!customerErr && req.customer) {
        return ApiResponse.success(res, {
          user_type: 'customer',
          user: req.customer,
          valid: true
        }, 'Token is valid');
      }

      // Token is invalid
      return ApiResponse.unauthorized(res, 'Invalid or expired token');
    });
  });
}));

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private (Admin or Customer)
 */
router.post('/logout', asyncHandler(async (req, res) => {
  const ApiResponse = require('../utils/response');
  
  // Since we're using stateless JWT, logout is handled client-side
  // This endpoint just confirms logout request
  return ApiResponse.success(res, null, 'Logged out successfully');
}));

module.exports = router;