const express = require('express');
const { ReceiptController } = require('../controllers');
const { verifyAdmin, verifyCustomer } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const ValidationSchemas = require('../utils/validation');

const router = express.Router();

/**
 * Receipt Management Routes
 * Base path: /api/v1/receipts
 */

// ===== RECEIPT RETRIEVAL (ADMIN) =====

/**
 * @route   GET /api/v1/receipts
 * @desc    Get all receipts with pagination and filters
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
    require('express-validator').query('payment_type')
      .optional({ values: 'falsy' })
      .isIn(['bill', 'contribution', 'fine', 'advance'])
      .withMessage('Valid payment type is required'),
    require('express-validator').query('date_from')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Valid date_from format required (YYYY-MM-DD)'),
    require('express-validator').query('date_to')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Valid date_to format required (YYYY-MM-DD)'),
    require('express-validator').query('search')
      .optional({ values: 'falsy' })
      .isString()
      .trim()
      .withMessage('Search must be a string')
  ],
  handleValidationErrors,
  asyncHandler(ReceiptController.getAllReceipts)
);

/**
 * @route   GET /api/v1/receipts/summary
 * @desc    Get receipt summary statistics
 * @access  Private (Admin only)
 */
router.get('/summary',
  verifyAdmin,
  [
    require('express-validator').query('date_from')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Valid date_from format required (YYYY-MM-DD)'),
    require('express-validator').query('date_to')
      .optional({ values: 'falsy' })
      .isISO8601()
      .withMessage('Valid date_to format required (YYYY-MM-DD)')
  ],
  handleValidationErrors,
  asyncHandler(ReceiptController.getReceiptSummary)
);

/**
 * @route   GET /api/v1/receipts/search
 * @desc    Search receipts by query
 * @access  Private (Admin only)
 */
router.get('/search',
  verifyAdmin,
  [
    require('express-validator').query('q')
      .notEmpty()
      .withMessage('Search query is required')
      .isString()
      .trim(),
    require('express-validator').query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ],
  handleValidationErrors,
  asyncHandler(ReceiptController.searchReceipts)
);

/**
 * @route   GET /api/v1/receipts/customer/:customerId
 * @desc    Get customer receipts
 * @access  Private (Admin or Customer accessing own)
 */
router.get('/customer/:customerId',
  [verifyAdmin, verifyCustomer],
  [
    ...ValidationSchemas.pagination,
    require('express-validator').param('customerId')
      .isInt({ min: 1 })
      .withMessage('Valid customer ID is required')
  ],
  handleValidationErrors,
  asyncHandler(ReceiptController.getCustomerReceipts)
);

/**
 * @route   GET /api/v1/receipts/customer/:customerId/summary
 * @desc    Get customer receipt summary
 * @access  Private (Admin or Customer accessing own)
 */
router.get('/customer/:customerId/summary',
  [verifyAdmin, verifyCustomer],
  [
    require('express-validator').param('customerId')
      .isInt({ min: 1 })
      .withMessage('Valid customer ID is required')
  ],
  handleValidationErrors,
  asyncHandler(ReceiptController.getCustomerReceiptSummary)
);

/**
 * @route   GET /api/v1/receipts/:receiptId
 * @desc    Get single receipt by ID
 * @access  Private (Admin or Customer accessing own)
 */
router.get('/:receiptId',
  [verifyAdmin, verifyCustomer],
  [
    require('express-validator').param('receiptId')
      .isInt({ min: 1 })
      .withMessage('Valid receipt ID is required')
  ],
  handleValidationErrors,
  asyncHandler(ReceiptController.getReceiptById)
);

// Customer-specific receipt routes
/**
 * @route   GET /api/v1/receipts/me/receipts
 * @desc    Get customer's own receipts
 * @access  Private (Customer only)
 */
router.get('/me/receipts',
  verifyCustomer,
  [
    ...ValidationSchemas.pagination
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    req.params.customerId = req.customer.id;
    return ReceiptController.getCustomerReceipts(req, res);
  })
);

/**
 * @route   GET /api/v1/receipts/me/summary
 * @desc    Get customer's own receipt summary
 * @access  Private (Customer only)
 */
router.get('/me/summary',
  verifyCustomer,
  asyncHandler(async (req, res) => {
    req.params.customerId = req.customer.id;
    return ReceiptController.getCustomerReceiptSummary(req, res);
  })
);

module.exports = router;
