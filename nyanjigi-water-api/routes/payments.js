const express = require('express');
const PaymentController = require('../controllers/PaymentController');
const { verifyAdmin, verifyToken } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const { query, param } = require('express-validator');
const router = express.Router();


/**
 * Get available payment methods
 */
router.get('/methods',
  asyncHandler(PaymentController.getPaymentMethods)
);

/**
 * Get all payments in the system (Admin only)
 */
router.get('/all',
  verifyAdmin,
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('customer_id').optional().isInt({ min: 1 }).toInt(),
    query('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']),
    query('date_from').optional().isISO8601().toDate(),
    query('date_to').optional().isISO8601().toDate(),
    query('search').optional().isString().trim()
  ],
  handleValidationErrors,
  asyncHandler(PaymentController.getAllPayments)
);
/**
 * Get payment statistics (Admin only)
 */
router.get('/stats',
  verifyAdmin,
  [
    query('period').optional().isIn(['daily', 'monthly', 'yearly'])
  ],
  handleValidationErrors,
  asyncHandler(PaymentController.getPaymentStats)
);

/**
 * Get payment status by transaction ID
 */
router.get('/status/:transactionId',
  [
    param('transactionId').notEmpty().withMessage('Transaction ID is required')
  ],
  handleValidationErrors,
  asyncHandler(PaymentController.getPaymentStatus)
);

/**
 * Get payment history for authenticated customer
 */
router.get('/history',
  verifyToken,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const customerId = req.customer?.id || req.admin?.id;
    
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    
    const Payment = require('../models/Payment');
    const result = await Payment.getCustomerPayments(customerId, page, limit);
    
    const ApiResponse = require('../utils/response');
    return ApiResponse.success(res, result, 'Payment history retrieved');
  })
);

/**
 * Get payment details
 */
router.get('/:paymentId',
  verifyToken,
  [
    param('paymentId').isInt({ min: 1 })
  ],
  handleValidationErrors,
  asyncHandler(PaymentController.getPaymentDetails)
);


module.exports = router;