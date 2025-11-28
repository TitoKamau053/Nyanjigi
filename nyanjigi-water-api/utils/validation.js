const { body, param, query } = require('express-validator');

/**
 * Validation schemas for API endpoints
 */

const ValidationSchemas = {
  // Admin validation
  adminLogin: [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],

  // Customer validation
  createCustomer: [
    body('full_name').trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
    body('phone').isMobilePhone('any').withMessage('Valid phone number is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('zone').optional().isIn(['Nyakahura', 'G3', 'Githunguri']).withMessage('Zone must be one of: Nyakahura, G3, Githunguri'),
    body('connection_date').isISO8601().toDate().withMessage('Valid connection date is required'),
    body('meter_number').optional().trim()
  ],

  updateCustomer: [
    param('id').isInt({ min: 1 }).withMessage('Valid customer ID is required'),
    body('full_name').optional().trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
    body('phone').optional().isMobilePhone('any').withMessage('Valid phone number is required'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('location').optional().trim().notEmpty().withMessage('Location cannot be empty'),
    body('meter_number').optional().trim(),
    body('is_active').optional().isBoolean().withMessage('Active status must be boolean')
  ],

  customerLogin: [
    body('account_number').trim().notEmpty().withMessage('Account number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],

  // Payment validation
  initiatePayment: [
    body('customer_id').isInt({ min: 1 }).withMessage('Valid customer ID is required'),
    body('amount').isFloat({ min: 1 }).withMessage('Amount must be greater than 0'),
    body('phone_number').isMobilePhone('any').withMessage('Valid phone number is required'),
    body('payment_type').isIn(['bill', 'contribution', 'fine']).withMessage('Valid payment type is required')
  ],

  // Bill validation
  generateBills: [
    body('billing_month').isISO8601().toDate().withMessage('Valid billing month is required'),
    body('customer_ids').optional().isArray().withMessage('Customer IDs must be an array')
  ],

  // Fine validation
  applyFine: [
    body('customer_id').isInt({ min: 1 }).withMessage('Valid customer ID is required'),
    body('fine_type_id').isInt({ min: 1 }).withMessage('Valid fine type ID is required'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    body('bill_id').optional().isInt({ min: 1 }).withMessage('Valid bill ID is required')
  ],

  // Query validation
  pagination: [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 200'),
    query('search').optional().trim(),
    query('status').optional().trim(),
    query('sort').optional().isIn(['asc', 'desc']).withMessage('Sort must be asc or desc')
  ],

  // System settings validation
  updateSettings: [
    body('settings').isObject().withMessage('Settings must be an object'),
    body('settings').custom((settings) => {
      if (!settings || typeof settings !== 'object') {
        throw new Error('Settings must be an object');
      }
      // Check if settings object is not empty
      if (Object.keys(settings).length === 0) {
        throw new Error('At least one setting is required');
      }
      return true;
    }),
    body('settings.*.value').notEmpty().withMessage('Setting value is required'),
    body('settings.*.description').optional().trim()
  ],

  // Password change validation
  changePassword: [
    body('current_password').trim().notEmpty().withMessage('Current password is required'),
    body('new_password')
      .isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
      .custom((value, { req }) => {
        if (value === req.body.current_password) {
          throw new Error('New password must be different from current password');
        }
        return true;
      })
  ],

  // Admin profile update validation
  updateAdminProfile: [
    body('full_name').optional().trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
    body('email').optional().isEmail().withMessage('Valid email is required'),
    body('username').optional().trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters')
  ],

  // ID parameter validation
  idParam: [
    param('id').isInt({ min: 1 }).withMessage('Valid ID is required')
  ],

  accountNumberParam: [
    param('account_number').matches(/^NyWs-\d{5}$/).withMessage('Valid account number format required (NyWs-00001)')
  ]
};

module.exports = ValidationSchemas;