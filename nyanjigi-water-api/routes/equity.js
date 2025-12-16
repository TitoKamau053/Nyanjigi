const express = require('express');
const EquityController = require('../controllers/EquityController');
const { verifyAdmin, verifyCustomer, verifyToken } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const { body, param, query } = require('express-validator');

const router = express.Router();

const EQUITY_WHITELIST = [
  '196.216.242.224',
  '196.216.242.223',
  '196.216.242.163',
  '196.216.242.171',
  '20.50.237.39',
  '20.50.237.229',
  '127.0.0.1',
  '72.61.196.95',
  '41.139.204.135'

];

const checkWhitelist = (req, res, next) => {
  // Get client IP (handling IPv6 mapping if present)
  let clientIp = req.ip || req.connection.remoteAddress;
  if (clientIp.substr(0, 7) === "::ffff:") {
    clientIp = clientIp.substr(7);
  }

  // Check if IP is allowed
  if (!EQUITY_WHITELIST.includes(clientIp)) {
    console.warn(`[SECURITY] Blocked unauthorized Equity access from IP: ${clientIp}`);
    return res.status(403).json({
      success: false,
      message: 'Access Forbidden: Unauthorized Source'
    });
  }
  next();
};

/**
 * PUBLIC ENDPOINTS (Called by Equity Bank)
 */

// Customer validation endpoint
router.post('/validate-customer',
  checkWhitelist,
  [
    body('member_number').trim().notEmpty().withMessage('Member number is required'),
    body('phone').optional().matches(/^(\+254|254|0)[17]\d{8}$/).withMessage('Valid phone number required')
  ],
  handleValidationErrors,
  asyncHandler(EquityController.validateCustomer.bind(EquityController))
);

// Payment callback endpoint
router.post('/callback',
  checkWhitelist, 
  [
    body('transaction_id').trim().notEmpty().withMessage('Transaction ID is required'),
    body('member_number').trim().notEmpty().withMessage('Member number is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
    body('payment_method').isIn(['branch', 'agent', 'equitel', 'mpesa', 'ussd', 'app']).withMessage('Valid payment method is required'),
    body('status').isIn(['success', 'failed', 'completed', 'pending']).withMessage('Valid status is required')
  ],
  handleValidationErrors,
  asyncHandler(EquityController.handlePaymentCallback.bind(EquityController))
);

/**
 * AUTHENTICATED ENDPOINTS (Customer/Admin)
 */

// Get all equity payments across all customers (Admin only)
router.get('/payments/all',
  verifyAdmin,
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    const { executeQuery } = require('../config/database');
    const ApiResponse = require('../utils/response');
    
    try {
      const { page = 1, limit = 20 } = req.query;
      const pageInt = parseInt(page);
      const limitInt = parseInt(limit);
      const offset = (pageInt - 1) * limitInt;

      const paymentsQuery = `
        SELECT
          p.*,
          c.account_number,
          c.full_name as customer_name
        FROM payments p
        INNER JOIN customers c ON p.customer_id = c.id
        WHERE p.payment_method LIKE 'equity_%'
        ORDER BY p.payment_date DESC
        LIMIT ${limitInt} OFFSET ${offset}
      `;

      const payments = await executeQuery(paymentsQuery);

      const countQuery = `
        SELECT COUNT(*) as total 
        FROM payments 
        WHERE payment_method LIKE 'equity_%'
      `;
      const countResult = await executeQuery(countQuery);
      const total = countResult[0].total;

      return ApiResponse.success(res, {
        payments,
        pagination: {
          page: pageInt,
          limit: limitInt,
          total,
          pages: Math.ceil(total / limitInt)
        }
      });
    } catch (error) {
      console.error('[All Equity Payments] Error:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  })
);
// Get payment history - Admin sees any customer, Customer sees only their own

  router.get('/history/:customer_id',
    verifyToken,
    [
      param('customer_id').isInt({ min: 1 }).withMessage('Valid customer ID is required'),
      query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit between 1-100')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
      const { executeQuery } = require('../config/database');
      const ApiResponse = require('../utils/response');
      
      try {
        const { customer_id } = req.params;
        const { page = 1, limit = 20 } = req.query;
        
        const pageInt = parseInt(page);
        const limitInt = parseInt(limit);
        const offset = (pageInt - 1) * limitInt;

        // Customer can only view their own payments, admin can view any
        if (req.customer && req.customer.id !== parseInt(customer_id)) {
          return ApiResponse.forbidden(res, 'You can only view your own payment history');
        }
        // If req.admin exists, they can view any customer's payments

        const historyQuery = `
          SELECT
            p.id,
            p.transaction_id,
            p.equity_reference,
            p.amount,
            p.payment_date,
            p.payment_method,
            p.status,
            p.notes,
            (
              SELECT JSON_ARRAYAGG(
                JSON_OBJECT(
                  'type', pa.allocation_type,
                  'amount', pa.amount,
                  'bill_number', b.bill_number
                )
              )
              FROM payment_allocations pa
              LEFT JOIN bills b ON pa.bill_id = b.id
              WHERE pa.payment_id = p.id
            ) as allocations
          FROM payments p
          WHERE p.customer_id = ? 
          AND p.payment_method LIKE 'equity_%'
          ORDER BY p.payment_date DESC
          LIMIT ${limitInt} OFFSET ${offset}
        `;

        const payments = await executeQuery(historyQuery, [customer_id]);

        const countQuery = `
          SELECT COUNT(*) as total 
          FROM payments 
          WHERE customer_id = ? 
          AND payment_method LIKE 'equity_%'
        `;
        const countResult = await executeQuery(countQuery, [customer_id]);
        const total = countResult[0].total;

        return ApiResponse.success(res, {
          payments: payments.map(p => ({
            ...p,
            allocations: p.allocations || [] 
          })),
          pagination: {
            page: pageInt,
            limit: limitInt,
            total: total,
            pages: Math.ceil(total / limitInt)
          }
        });
      } catch (error) {
        console.error('[Payment History] Error:', error);
        return ApiResponse.error(res, error.message, 500);
      }
    })
  );

module.exports = router;