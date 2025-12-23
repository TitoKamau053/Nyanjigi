const express = require('express');
const EquityController = require('../controllers/EquityController');
const { verifyAdmin, verifyCustomer, verifyToken } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const { body, param, query } = require('express-validator');
const jwt = require('jsonwebtoken');

const router = express.Router();


const EQUITY_WHITELIST = [
  '196.216.242.224', '196.216.242.223', '196.216.242.163', 
  '196.216.242.171', '20.50.237.39', '20.50.237.229',
  '127.0.0.1', '72.61.196.95', '41.139.204.135'
];

// LAYER 1: IP Whitelist Middleware
const checkWhitelist = (req, res, next) => {
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

// LAYER 2: JWT Verification Middleware
const verifyEquityToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  // 1. Check if header exists and starts with Bearer
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: 'Authorization header missing or invalid format' 
    });
  }

  const token = authHeader.split(' ')[1]; // Extract the token

  try {
    // 2. Verify the token using secret key
    const decoded = jwt.verify(token, process.env.EQUITY_JWT_SECRET);
    
    // 3. Ensure it is an access token, not a refresh token
    if (decoded.type !== 'access') {
       return res.status(403).json({ success: false, message: 'Invalid token type' });
    }
    
    // Token is valid
    req.equityUser = decoded;
    next();
  } catch (err) {
    console.error('[Auth] Token verification failed:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * PUBLIC ENDPOINT (No Token Required)
 * Equity calls this to get their token.
 * We still check IP whitelist for safety.
 */
router.post('/auth/token',
  checkWhitelist,
  asyncHandler(EquityController.login.bind(EquityController))
);

/**
 * PROTECTED ENDPOINTS (Token Required)
 * These now require BOTH correct IP and valid Token
 */

// Customer validation endpoint
router.post('/validate-customer',
  checkWhitelist,     // 1. IP Check
  verifyEquityToken,  // 2. Token Check
  [
    body('member_number').trim().notEmpty().withMessage('Member number is required'),
    body('phone').optional().matches(/^(\+254|254|0)[17]\d{8}$/).withMessage('Valid phone number required')
  ],
  handleValidationErrors,
  asyncHandler(EquityController.validateCustomer.bind(EquityController))
);

// Payment callback endpoint
router.post('/callback',
  checkWhitelist,     // 1. IP Check
  verifyEquityToken,  // 2. Token Check
  [
    body('transaction_id').trim().notEmpty().withMessage('Transaction ID is required'),
    body('member_number').trim().notEmpty().withMessage('Member number is required'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Valid amount is required'),
    body('payment_method').trim().notEmpty().withMessage('Payment method is required'),
    body('status').optional()
  ],
  handleValidationErrors,
  asyncHandler(EquityController.handlePaymentCallback.bind(EquityController))
);

/**
 * AUTHENTICATED ENDPOINTS (Customer/Admin) */

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