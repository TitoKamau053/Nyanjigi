const express = require('express');
const { ContributionController } = require('../controllers');
const { verifyAdmin, verifyCustomer } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const ValidationSchemas = require('../utils/validation');

const router = express.Router();

/**
 * Contribution Management Routes
 * Base path: /api/v1/contributions
 */

// ===== CONTRIBUTION GENERATION (ADMIN) =====

/**
 * @route   POST /api/v1/contributions/generate
 * @desc    Generate monthly contributions for all or specific customers
 * @access  Private (Admin only)
 */
router.post('/generate',
  verifyAdmin,
  [
    require('express-validator').body('contribution_month')
      .isISO8601()
      .toDate()
      .withMessage('Valid contribution month is required (YYYY-MM-DD)'),
    require('express-validator').body('customer_ids')
      .optional()
      .isArray()
      .withMessage('Customer IDs must be an array'),
    require('express-validator').body('customer_ids.*')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid customer IDs are required')
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.generateMonthlyContributions)
);

/**
 * @route   POST /api/v1/contributions/bulk-generate
 * @desc    Bulk generate contributions for multiple months
 * @access  Private (Admin only)
 */
router.post('/bulk-generate',
  verifyAdmin,
  [
    require('express-validator').body('start_month')
      .isISO8601()
      .toDate()
      .withMessage('Valid start month is required (YYYY-MM-DD)'),
    require('express-validator').body('end_month')
      .isISO8601()
      .toDate()
      .withMessage('Valid end month is required (YYYY-MM-DD)'),
    require('express-validator').body('customer_ids')
      .optional()
      .isArray()
      .withMessage('Customer IDs must be an array'),
    require('express-validator').body('customer_ids.*')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid customer IDs are required')
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.bulkGenerateContributions)
);

// ===== CONTRIBUTION MANAGEMENT (ADMIN) =====

/**
 * @route   GET /api/v1/contributions
 * @desc    Get all contributions with pagination and filters
 * @access  Private (Admin only)
 */
router.get('/',
  verifyAdmin,
  [
    ...ValidationSchemas.pagination,
    require('express-validator').query('customer_id')
      .optional({ values: 'falsy' })  
      .isInt({ min: 1 })
      .withMessage('Valid customer ID is required'),
    require('express-validator').query('status')
      .optional({ values: 'falsy' }) 
      .isIn(['pending', 'partial', 'completed', 'overdue'])
      .withMessage('Valid status is required'),
    require('express-validator').query('contribution_month')
      .optional({ values: 'falsy' })  
      .isISO8601()
      .withMessage('Valid contribution month format required (YYYY-MM-DD)'),
    require('express-validator').query('overdue')
      .optional({ values: 'falsy' })  
      .isBoolean()
      .withMessage('Overdue must be boolean')
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.getAllContributions)
);

/**
 * @route   GET /api/v1/contributions/dashboard
 * @desc    Get contribution dashboard data
 * @access  Private (Admin only)
 */
router.get('/dashboard',
  verifyAdmin,
  asyncHandler(ContributionController.getContributionDashboard)
);

/**
 * @route   GET /api/v1/contributions/stats
 * @desc    Get contribution statistics
 * @access  Private (Admin only)
 */
router.get('/stats',
  verifyAdmin,
  [
    require('express-validator').query('period')
      .optional()
      .isIn(['monthly', 'yearly'])
      .withMessage('Period must be monthly or yearly')
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.getContributionStats)
);

/**
 * @route   GET /api/v1/contributions/overdue
 * @desc    Get overdue contributions
 * @access  Private (Admin only)
 */
router.get('/overdue',
  verifyAdmin,
  [
    require('express-validator').query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500')
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.getOverdueContributions)
);

/**
 * @route   GET /api/v1/contributions/summary
 * @desc    Get monthly contribution summary
 * @access  Private (Admin only)
 */
router.get('/summary',
  verifyAdmin,
  [
    require('express-validator').query('year')
      .optional()
      .isInt({ min: 2020, max: 2030 })
      .withMessage('Valid year is required'),
    require('express-validator').query('month')
      .optional()
      .isInt({ min: 1, max: 12 })
      .withMessage('Valid month is required (1-12)')
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.getMonthlyContributionSummary)
);

/**
 * @route   GET /api/v1/contributions/settings
 * @desc    Get contribution settings
 * @access  Private (Admin only)
 */
router.get('/settings',
  verifyAdmin,
  asyncHandler(ContributionController.getContributionSettings)
);


/**
 * @route   PUT /api/v1/contributions/amount
 * @desc    Update contribution amount system-wide
 * @access  Private (Admin only)
 */
router.put('/amount',
  verifyAdmin,
  [
    require('express-validator').body('new_amount')
      .isFloat({ min: 1 })
      .withMessage('New amount must be greater than 0'),
    require('express-validator').body('effective_from_month')
      .notEmpty()
      .withMessage('Effective from month is required')
      .isISO8601()
      .withMessage('Valid effective from month is required (YYYY-MM-DD format)')
      // Removed .toDate() - let the controller handle date parsing
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.updateContributionAmount)
);

/**
 * @route   GET /api/v1/contributions/export
 * @desc    Export contributions data
 * @access  Private (Admin only)
 */
router.get('/export',
  verifyAdmin,
  [
    require('express-validator').query('format')
      .optional()
      .isIn(['json', 'csv'])
      .withMessage('Format must be json or csv'),
    require('express-validator').query('status')
      .optional()
      .isIn(['pending', 'partial', 'completed', 'overdue'])
      .withMessage('Valid status is required'),
    require('express-validator').query('contribution_month')
      .optional()
      .isISO8601()
      .withMessage('Valid contribution month format required'),
    require('express-validator').query('customer_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid customer ID is required')
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.exportContributions)
);

// ===== SPECIFIC CONTRIBUTION OPERATIONS =====

/**
 * @route   POST /api/v1/contributions/:contributionId/mark-paid
 * @desc    Mark contribution as paid (manual payment)
 * @access  Private (Admin only)
 */
router.post('/:contributionId/mark-paid',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    require('express-validator').body('amount_paid')
      .optional()
      .isFloat({ min: 0.01 })
      .withMessage('Amount paid must be greater than 0'),
    require('express-validator').body('payment_notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Payment notes must be less than 500 characters')
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.markContributionAsPaid)
);

// ===== CUSTOMER-SPECIFIC CONTRIBUTIONS =====

/**
 * @route   GET /api/v1/contributions/customer/:customerId
 * @desc    Get contributions for specific customer (Admin view)
 * @access  Private (Admin only)
 */
router.get('/customer/:customerId',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    ...ValidationSchemas.pagination
  ],
  handleValidationErrors,
  asyncHandler(ContributionController.getCustomerContributions)
);

/**
 * @route   GET /api/v1/contributions/customer/:customerId/summary
 * @desc    Get contribution summary for specific customer
 * @access  Private (Admin only)
 */
router.get('/customer/:customerId/summary',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(ContributionController.getCustomerContributionSummary)
);

// ===== CUSTOMER SELF-SERVICE ROUTES =====

/**
 * @route   GET /api/v1/contributions/me
 * @desc    Get customer's own contributions
 * @access  Private (Customer only)
 */
router.get('/me',
  verifyCustomer,
  ValidationSchemas.pagination,
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    // Set customer ID from auth context
    req.params.customerId = req.customer.id;
    return ContributionController.getCustomerContributions(req, res);
  })
);

/**
 * @route   GET /api/v1/contributions/me/summary
 * @desc    Get customer's own contribution summary
 * @access  Private (Customer only)
 */
router.get('/me/summary',
  verifyCustomer,
  asyncHandler(async (req, res) => {
    // Set customer ID from auth context
    req.params.customerId = req.customer.id;
    return ContributionController.getCustomerContributionSummary(req, res);
  })
);

/**
 * @route   GET /api/v1/contributions/:contributionId
 * @desc    Get single contribution details
 * @access  Private (Admin only)
 */
router.get('/:contributionId',
  verifyAdmin,
  [
    require('express-validator').param('contributionId')
      .isInt({ min: 1 })
      .withMessage('Valid contribution ID is required')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { contributionId } = req.params;
    const Contribution = require('../models/Contribution');
    const ApiResponse = require('../utils/response');
    
    const contribution = await Contribution.findById(parseInt(contributionId));
    
    if (!contribution) {
      return ApiResponse.notFound(res, 'Contribution not found');
    }
    
    // Get customer details
    const { executeQuery } = require('../config/database');
    const customerQuery = `
      SELECT account_number, full_name, phone 
      FROM customers 
      WHERE id = ?
    `;
    const customer = await executeQuery(customerQuery, [contribution.customer_id]);
    
    return ApiResponse.success(res, {
      ...contribution,
      customer: customer[0] || null
    }, 'Contribution details retrieved successfully');
  })
);

module.exports = router;