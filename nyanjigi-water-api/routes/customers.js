const express = require('express');
const { CustomerController } = require('../controllers');
const { verifyAdmin, verifyCustomer } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const ValidationSchemas = require('../utils/validation');

const router = express.Router();

/**
 * Customer Management Routes
 * Base path: /api/v1/customers
 */

// ===== ADMIN-ONLY CUSTOMER MANAGEMENT =====

/**
 * @route   POST /api/v1/customers
 * @desc    Create new customer
 * @access  Private (Admin only)
 */
router.post('/',
  verifyAdmin,
  ValidationSchemas.createCustomer,
  handleValidationErrors,
  asyncHandler(CustomerController.createCustomer)
);

/**
 * @route   POST /api/v1/customers/send-password
 * @desc    Send password to customer via SMS
 * @access  Private (Admin only)
 */
router.post('/send-password',
  verifyAdmin,
  [
    require('express-validator').body('phone')
      .notEmpty()
      .withMessage('Phone number is required')
      .matches(/^(\+254|254|0)[17]\d{8}$/)
      .withMessage('Valid Kenyan phone number is required'),
    require('express-validator').body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters'),
    require('express-validator').body('customer_name')
      .optional()
      .isLength({ min: 1 })
      .withMessage('Customer name is required if provided')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      const { phone, password, customer_name } = req.body;
      
      // Import SMS service here to avoid circular dependencies
      const SMSService = require('../services/SMSService');
      
      // Create customer object for SMS service
      const customer = {
        full_name: customer_name || 'Customer',
        phone: phone,
        account_number: 'NEW' // Placeholder for new customers
      };

      // Send password via SMS
      const result = await SMSService.sendPasswordNotification(customer, password);

      if (result.success) {
        return require('../utils/response').success(res, {
          message_id: result.message_id,
          phone: result.phone,
          status: result.status
        }, 'Password sent successfully via SMS');
      } else {
        return require('../utils/response').error(res, result.error || 'Failed to send SMS', 400, {
          phone: result.phone
        });
      }
    } catch (error) {
      console.error('Send password SMS error:', error);
      return require('../utils/response').error(res, error.message, 500);
    }
  })
);

/**
 * @route   GET /api/v1/customers
 * @desc    Get all customers with pagination and search
 * @access  Private (Admin only)
 */
router.get('/',
  verifyAdmin,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(CustomerController.getAllCustomers)
);

/**
 * @route   GET /api/v1/customers/stats
 * @desc    Get customer statistics
 * @access  Private (Admin only)
 */
router.get('/stats',
  verifyAdmin,
  asyncHandler(CustomerController.getCustomerStats)
);

/**
 * @route   GET /api/v1/customers/search
 * @desc    Search customers
 * @access  Private (Admin only)
 */
router.get('/search',
  verifyAdmin,
  [
    ValidationSchemas.pagination[2] // search validation
  ],
  handleValidationErrors,
  asyncHandler(CustomerController.searchCustomers)
);

/**
 * @route   GET /api/v1/customers/:customerId
 * @desc    Get specific customer details
 * @access  Private (Admin only)
 */
router.get('/:customerId',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(CustomerController.getCustomerById)
);

/**
 * @route   PUT /api/v1/customers/:customerId
 * @desc    Update customer information
 * @access  Private (Admin only)
 */
router.put('/:customerId',
  verifyAdmin,
  ValidationSchemas.updateCustomer,
  handleValidationErrors,
  asyncHandler(CustomerController.updateCustomer)
);

/**
 * @route   POST /api/v1/customers/:id/toggle-status
 * @desc    Activate/deactivate customer
 * @access  Private (Admin only)
 */
router.post('/:id/toggle-status',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(CustomerController.toggleStatus)
);

/**
 * @route   POST /api/v1/customers/:customerId/reset-password
 * @desc    Reset customer password
 * @access  Private (Admin only)
 */
router.post('/:customerId/reset-password',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    require('express-validator').body('new_password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],
  handleValidationErrors,
  asyncHandler(CustomerController.resetPassword)
);

// ===== CUSTOMER SELF-SERVICE ROUTES =====
// These routes allow customers to access their own data

/**
 * @route   GET /api/v1/customers/me/bills
 * @desc    Get customer's own bills
 * @access  Private (Customer only)
 */
router.get('/me/bills',
  verifyCustomer,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(CustomerController.getBills)
);

/**
 * @route   GET /api/v1/customers/bills
 * @desc    Get customer's own bills (alternative endpoint)
 * @access  Private (Customer only)
 */
router.get('/bills',
  verifyCustomer,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(CustomerController.getBills)
);

/**
 * @route   GET /api/v1/customers/me/bills/:billId
 * @desc    Get specific bill details (Customer's own)
 * @access  Private (Customer only)
 */
router.get('/me/bills/:billId',
  verifyCustomer,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(CustomerController.getBillDetails)
);

// The above customer self-service bill routes are moved before parameterized routes below


/**
 * @route   GET /api/v1/customers/me/payments
 * @desc    Get customer's own payments
 * @access  Private (Customer only)
 */
router.get('/me/payments',
  verifyCustomer,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(CustomerController.getPayments)
);

/**
 * @route   GET /api/v1/customers/me/payments/:paymentId
 * @desc    Get specific payment details (Customer's own)
 * @access  Private (Customer only)
 */
router.get('/me/payments/:paymentId',
  verifyCustomer,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(CustomerController.getPaymentDetails)
);

/**
 * @route   GET /api/v1/customers/me/contributions
 * @desc    Get customer's own contributions
 * @access  Private (Customer only)
 */
router.get('/me/contributions',
  verifyCustomer,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(CustomerController.getContributions)
);

/**
 * @route   GET /api/v1/customers/me/fines
 * @desc    Get customer's own fines
 * @access  Private (Customer only)
 */
router.get('/me/fines',
  verifyCustomer,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(CustomerController.getFines)
);

/**
 * @route   GET /api/v1/customers/me/contributions
 * @desc    Get customer's own contributions
 * @access  Private (Customer only)
 */
router.get('/me/contributions',
  verifyCustomer,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(CustomerController.getContributions)
);

/**
 * @route   GET /api/v1/customers/me/account-summary
 * @desc    Get customer's own account summary
 * @access  Private (Customer only)
 */
router.get('/me/account-summary',
  verifyCustomer,
  asyncHandler(CustomerController.getAccountSummary)
);

// ===== ADMIN-ONLY CUSTOMER MANAGEMENT =====

/**
 * @route   POST /api/v1/customers
 * @desc    Create new customer
 * @access  Private (Admin only)
 */
router.post('/',
  verifyAdmin,
  ValidationSchemas.createCustomer,
  handleValidationErrors,
  asyncHandler(CustomerController.createCustomer)
);

/**
 * @route   GET /api/v1/customers
 * @desc    Get all customers with pagination and search
 * @access  Private (Admin only)
 */
router.get('/',
  verifyAdmin,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(CustomerController.getAllCustomers)
);

/**
 * @route   GET /api/v1/customers/stats
 * @desc    Get customer statistics
 * @access  Private (Admin only)
 */
router.get('/stats',
  verifyAdmin,
  asyncHandler(CustomerController.getCustomerStats)
);

/**
 * @route   GET /api/v1/customers/search
 * @desc    Search customers
 * @access  Private (Admin only)
 */
router.get('/search',
  verifyAdmin,
  [
    ValidationSchemas.pagination[2] // search validation
  ],
  handleValidationErrors,
  asyncHandler(CustomerController.searchCustomers)
);

/**
 * @route   GET /api/v1/customers/:customerId
 * @desc    Get specific customer details
 * @access  Private (Admin only)
 */
router.get('/:customerId',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(CustomerController.getCustomerById)
);

/**
 * @route   PUT /api/v1/customers/:customerId
 * @desc    Update customer information
 * @access  Private (Admin only)
 */
router.put('/:customerId',
  verifyAdmin,
  ValidationSchemas.updateCustomer,
  handleValidationErrors,
  asyncHandler(CustomerController.updateCustomer)
);

/**
 * @route   POST /api/v1/customers/:id/toggle-status
 * @desc    Activate/deactivate customer
 * @access  Private (Admin only)
 */
router.post('/:id/toggle-status',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(CustomerController.toggleStatus)
);

/**
 * @route   POST /api/v1/customers/:customerId/reset-password
 * @desc    Reset customer password
 * @access  Private (Admin only)
 */
router.post('/:customerId/reset-password',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    require('express-validator').body('new_password')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],
  handleValidationErrors,
  asyncHandler(CustomerController.resetPassword)
);

// ===== CUSTOMER BILLS (ADMIN ACCESS) =====

/**
 * @route   GET /api/v1/customers/:customerId/bills
 * @desc    Get customer bills (Admin view)
 * @access  Private (Admin only)
 */
router.get('/:customerId/bills',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    ...ValidationSchemas.pagination
  ],
  handleValidationErrors,
  asyncHandler(CustomerController.getBills)
);

/**
 * @route   GET /api/v1/customers/:customerId/bills/summary
 * @desc    Get customer bill summary
 * @access  Private (Admin only)
 */
router.get('/:customerId/bills/summary',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(require('../controllers/BillController').getCustomerBillSummary)
);

// ===== CUSTOMER PAYMENTS (ADMIN ACCESS) =====

/**
 * @route   GET /api/v1/customers/:customerId/payments
 * @desc    Get customer payments (Admin view)
 * @access  Private (Admin only)
 */
router.get('/:customerId/payments',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    ...ValidationSchemas.pagination
  ],
  handleValidationErrors,
  asyncHandler(CustomerController.getPayments)
);

// ===== CUSTOMER CONTRIBUTIONS (ADMIN ACCESS) =====

/**
 * @route   GET /api/v1/customers/:customerId/contributions
 * @desc    Get customer contributions (Admin view)
 * @access  Private (Admin only)
 */
router.get('/:customerId/contributions',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    ...ValidationSchemas.pagination
  ],
  handleValidationErrors,
  asyncHandler(CustomerController.getContributions)
);

/**
 * @route   GET /api/v1/customers/:customerId/contributions/summary
 * @desc    Get customer contribution summary
 * @access  Private (Admin only)
 */
router.get('/:customerId/contributions/summary',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(require('../controllers/ContributionController').getCustomerContributionSummary)
);

// ===== CUSTOMER ACCOUNT SUMMARY =====

/**
 * @route   GET /api/v1/customers/:customerId/account-summary
 * @desc    Get complete customer account summary
 * @access  Private (Admin only)
 */
router.get('/:customerId/account-summary',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(CustomerController.getAccountSummary)
);

module.exports = router;

