const express = require('express');
const { BillController } = require('../controllers');
const { Bill } = require('../models');
const { verifyAdmin, verifyCustomer } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const ValidationSchemas = require('../utils/validation');
const ApiResponse = require('../utils/response');

const router = express.Router();

/**
 * Billing Management Routes
 * Base path: /api/v1/bills
 */

// ===== BILL GENERATION =====

/**
 * @route   POST /api/v1/bills/generate
 * @desc    Generate monthly bills for all or specific customers
 * @access  Private (Admin only)
 */
router.post('/generate',
  verifyAdmin,
  ValidationSchemas.generateBills,
  handleValidationErrors,
  asyncHandler(BillController.generateMonthlyBills)
);

/**
 * @route   POST /api/v1/bills/generate/:customerId
 * @desc    Generate bill for a specific customer
 * @access  Private (Admin only)
 */
router.post('/generate/:customerId',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    require('express-validator').body('billing_month')
      .isISO8601()
      .withMessage('Valid billing month is required')
  ],
  handleValidationErrors,
  asyncHandler(BillController.generateCustomerBill)
);

/**
 * @route   POST /api/v1/bills/preview
 * @desc    Generate bill preview for a customer
 * @access  Private (Admin only)
 */
router.post('/preview',
  verifyAdmin,
  [
    require('express-validator').body('customer_id')
      .isInt({ min: 1 })
      .withMessage('Valid customer ID is required'),
    require('express-validator').body('billing_month')
      .isISO8601()
      .toDate()
      .withMessage('Valid billing month is required')
  ],
  handleValidationErrors,
  asyncHandler(BillController.generateBillPreview)
);

// ===== BILL MANAGEMENT =====

/**
 * @route   GET /api/v1/bills
 * @desc    Get all bills with pagination and filters
 * @access  Private (Admin only)
 */
router.get('/',
  verifyAdmin,
  [
    ...ValidationSchemas.pagination,
    require('express-validator').query('customer_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid customer ID is required'),
    require('express-validator').query('status')
      .optional()
      .isIn(['pending', 'paid', 'overdue', 'partially_paid'])
      .withMessage('Valid status is required'),
    require('express-validator').query('billing_month')
      .optional()
      .isISO8601()
      .withMessage('Valid billing month format required (YYYY-MM-DD)'),
    require('express-validator').query('overdue')
      .optional()
      .isBoolean()
      .withMessage('Overdue must be boolean')
  ],
  handleValidationErrors,
  asyncHandler(BillController.getAllBills)
);

/**
 * @route   GET /api/v1/bills/stats
 * @desc    Get billing statistics
 * @access  Private (Admin only)
 */
router.get('/stats',
  verifyAdmin,
  [
    require('express-validator').query('period')
      .optional()
      .isIn(['daily', 'monthly', 'yearly'])
      .withMessage('Period must be daily, monthly, or yearly')
  ],
  handleValidationErrors,
  asyncHandler(BillController.getBillingStats)
);

/**
 * @route   GET /api/v1/bills/overdue
 * @desc    Get overdue bills
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
  asyncHandler(BillController.getOverdueBills)
);

/**
 * @route   GET /api/v1/bills/summary
 * @desc    Get monthly billing summary
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
  asyncHandler(BillController.getMonthlyBillingSummary)
);

/**
 * @route   GET /api/v1/bills/export
 * @desc    Export bills data
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
      .isIn(['pending', 'paid', 'overdue', 'partially_paid'])
      .withMessage('Valid status is required'),
    require('express-validator').query('billing_month')
      .optional()
      .isISO8601()
      .withMessage('Valid billing month format required'),
    require('express-validator').query('customer_id')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Valid customer ID is required')
  ],
  handleValidationErrors,
  asyncHandler(BillController.exportBills)
);

// ===== SPECIFIC BILL OPERATIONS =====

/**
 * @route   GET /api/v1/bills/:billId
 * @desc    Get specific bill details
 * @access  Private (Admin only)
 */
router.get('/:billId',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(BillController.getBillDetails)
);

/**
 * @route   PUT /api/v1/bills/:billId/status
 * @desc    Update bill status
 * @access  Private (Admin only)
 */
router.put('/:billId/status',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    require('express-validator').body('status')
      .isIn(['pending', 'paid', 'overdue', 'partially_paid'])
      .withMessage('Valid status is required')
  ],
  handleValidationErrors,
  asyncHandler(BillController.updateBillStatus)
);

/**
 * @route   DELETE /api/v1/bills/:billId
 * @desc    Delete bill (use with caution)
 * @access  Private (Admin only)
 */
router.delete('/:billId',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    require('express-validator').body('confirm')
      .isBoolean()
      .custom(value => {
        if (!value) {
          throw new Error('Deletion must be confirmed');
        }
        return true;
      })
      .withMessage('Deletion must be confirmed by setting confirm: true')
  ],
  handleValidationErrors,
  asyncHandler(BillController.deleteBill)
);

// ===== BULK OPERATIONS =====

/**
 * @route   PUT /api/v1/bills/bulk/status
 * @desc    Bulk update bill status
 * @access  Private (Admin only)
 */
router.put('/bulk/status',
  verifyAdmin,
  [
    require('express-validator').body('bill_ids')
      .isArray({ min: 1 })
      .withMessage('Bill IDs array is required'),
    require('express-validator').body('bill_ids.*')
      .isInt({ min: 1 })
      .withMessage('Valid bill IDs are required'),
    require('express-validator').body('status')
      .isIn(['pending', 'paid', 'overdue', 'partially_paid'])
      .withMessage('Valid status is required')
  ],
  handleValidationErrors,
  asyncHandler(BillController.bulkUpdateBillStatus)
);

// ===== CUSTOMER-SPECIFIC BILL ROUTES =====

/**
 * @route   GET /api/v1/bills/customer/:customerId
 * @desc    Get bills for specific customer
 * @access  Private (Admin only)
 */
router.get('/customer/:customerId',
  verifyAdmin,
  [
    ValidationSchemas.idParam[0],
    ...ValidationSchemas.pagination
  ],
  handleValidationErrors,
  asyncHandler(BillController.getCustomerBills)
);

/**
 * @route   GET /api/v1/bills/customer/:customerId/summary
 * @desc    Get billing summary for specific customer
 * @access  Private (Admin only)
 */
router.get('/customer/:customerId/summary',
  verifyAdmin,
  ValidationSchemas.idParam,
  handleValidationErrors,
  asyncHandler(BillController.getCustomerBillSummary)
);

module.exports = router;
