
const express = require('express');
const FineController = require('../controllers/FineController');
const { verifyAdmin, verifyCustomer } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const { body, param, query } = require('express-validator');

const router = express.Router();

// Get all applied fines for all customers (Admin only)
router.get('/',
  verifyAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer')
  ],
  handleValidationErrors,
  asyncHandler(FineController.getAllFines)
);

/**
 * Fine Management Routes
 * Base path: /api/v1/fines
 */

// Get all fine types (Admin and Customer)
router.get('/types',
  asyncHandler(FineController.getFineTypes)
);

// Get applied fines for a customer (Admin or Customer)
router.get('/customer/:customerId',
  verifyAdmin,
  [
    param('customerId').isInt().withMessage('Customer ID must be an integer'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1 }).withMessage('Limit must be a positive integer')
  ],
  handleValidationErrors,
  asyncHandler(FineController.getAppliedFines)
);

router.get('/me',
  verifyCustomer,
  asyncHandler(FineController.getAppliedFines)
);

// Apply a new fine to a customer (Admin only)
router.post('/',
  verifyAdmin,
  [
    body('customerId').isInt().withMessage('Customer ID must be an integer'),
    body('fineTypeId').isInt().withMessage('Fine Type ID must be an integer'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('reason').isString().notEmpty().withMessage('Reason is required'),
    body('appliedDate').isISO8601().withMessage('Applied date must be a valid date')
  ],
  handleValidationErrors,
  asyncHandler(FineController.applyFine)
);

// Update fine status (Admin only)
router.put('/:fineId/status',
  verifyAdmin,
  [
    param('fineId').isInt().withMessage('Fine ID must be an integer'),
    body('status').isIn(['pending', 'paid', 'waived']).withMessage('Invalid status value')
  ],
  handleValidationErrors,
  asyncHandler(FineController.updateFineStatus)
);

// Get fine details by ID (Admin or Customer)
router.get('/:fineId',
  verifyAdmin,
  [
    param('fineId').isInt().withMessage('Fine ID must be an integer')
  ],
  handleValidationErrors,
  asyncHandler(FineController.getFineDetails)
);

module.exports = router;
