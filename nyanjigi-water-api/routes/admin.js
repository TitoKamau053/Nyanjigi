const express = require('express');
const { AdminController, MeterReadingController} = require('../controllers');
const { verifyAdmin } = require('../middleware/auth');
const { handleValidationErrors, asyncHandler } = require('../middleware/errorHandler');
const SMSService = require('../services/SMSService');
const { Customer, Bill } = require('../models');
const ApiResponse = require('../utils/response');

const router = express.Router();

/**
 * Admin Dashboard Routes
 * Base path: /api/v1/admin
 */

// ===== DASHBOARD & ANALYTICS =====

/**
 * @route   GET /api/v1/admin/dashboard-comprehensive
 * @desc    Get high-density analytics: KPIs, revenue trend, distribution,
 *          top/poor performers, recent transactions (Powers revamped dashboard)
 * @access  Private (Admin only)
 */
router.get('/dashboard-comprehensive',
  verifyAdmin,
  [
    require('express-validator').query('period')
      .optional()
      .isIn(['7d', '30d', '90d', 'yearly'])
      .withMessage('Period must be 7d, 30d, 90d, or yearly')
  ],
  handleValidationErrors,
  asyncHandler(AdminController.getDashboardComprehensive)
);

/**
 * @route   GET /api/v1/admin/dashboard
 * @desc    Get admin dashboard statistics (Powers the new React Dashboard)
 * @access  Private (Admin only)
 */
router.get('/dashboard',
  verifyAdmin,
  asyncHandler(AdminController.getDashboard)
);

/**
 * @route   GET /api/v1/admin/revenue-analytics
 * @desc    Get revenue analytics
 * @access  Private (Admin only)
 */
router.get('/revenue-analytics',
  verifyAdmin,
  [
    require('express-validator').query('period')
      .optional()
      .isIn(['7d', '30d', '90d', 'daily', 'weekly', 'monthly', 'yearly'])
      .withMessage('Period must be 7d, 30d, 90d, daily, weekly, monthly, or yearly')
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      const { period = '30d' } = req.query;
      const { executeQuery } = require('../config/database');
      
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      
      const billsQuery = `
        SELECT DATE(created_at) as date, SUM(total_amount) as revenue
        FROM bills WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
        GROUP BY DATE(created_at) ORDER BY date ASC
      `;
      
      const billData = await executeQuery(billsQuery, [days]);
      const labels = [];
      const data = [];
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        let label = period === '7d' 
          ? date.toLocaleDateString('en-US', { weekday: 'short' })
          : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        labels.push(label);
        const dateStr = date.toISOString().split('T')[0];
        const dayRevenue = billData.find(b => b.date.toISOString().split('T')[0] === dateStr);
        data.push(dayRevenue ? parseFloat(dayRevenue.revenue) : 0);
      }
      
      return ApiResponse.success(res, { labels, data }, 'Revenue analytics retrieved');
    } catch (error) {
      console.error('Revenue analytics error:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  })
);

/**
 * @route   GET /api/v1/admin/financial-summary
 * @desc    Get comprehensive financial summary
 * @access  Private (Admin only)
 */
router.get('/financial-summary',
  verifyAdmin,
  [
    require('express-validator').query('period')
      .optional()
      .isIn(['7d', '30d', '90d', 'daily', 'monthly', 'yearly'])
      .withMessage('Period must be 7d, 30d, 90d, daily, monthly, or yearly')
  ],
  handleValidationErrors,
  asyncHandler(AdminController.getFinancialSummary)
);

// ===== CUSTOMER MANAGEMENT =====

/**
 * @route   GET /api/v1/admin/outstanding-customers
 * @desc    Get customers with outstanding balances
 * @access  Private (Admin only)
 */
router.get('/outstanding-customers',
  verifyAdmin,
  [
    require('express-validator').query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('Limit must be between 1 and 500')
  ],
  handleValidationErrors,
  asyncHandler(AdminController.getOutstandingCustomers)
);

/**
 * @route   GET /api/v1/admin/customers/export
 * @desc    Export customer data
 * @access  Private (Admin only)
 */
router.get('/customers/export',
  verifyAdmin,
  [
    require('express-validator').query('format')
      .optional()
      .isIn(['json', 'csv'])
      .withMessage('Format must be json or csv'),
    require('express-validator').query('status')
      .optional()
      .isIn(['active', 'inactive'])
      .withMessage('Status must be active or inactive')
  ],
  handleValidationErrors,
  asyncHandler(AdminController.exportCustomers)
);

//====METER READING ROUTES=====

router.get('/meter-readings/customers', verifyAdmin, MeterReadingController.getCustomersForReading);
router.post('/meter-readings', verifyAdmin, MeterReadingController.submitReadings);

// ===== SMS & NOTIFICATION MANAGEMENT =====

router.get('/sms/status', verifyAdmin, asyncHandler(async (req, res) => {
  try {
    const [connectionTest, balance] = await Promise.all([
      SMSService.testConnection(),
      SMSService.getAccountBalance()
    ]);
    return ApiResponse.success(res, { service_status: connectionTest, account_balance: balance, last_checked: new Date().toISOString() }, 'SMS status retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
}));

router.post('/sms/send', verifyAdmin,
  [
    require('express-validator').body('phone_number').notEmpty().matches(/^(\+254|254|0)[17]\d{8}$/),
    require('express-validator').body('message').notEmpty().isLength({ max: 160 }),
    require('express-validator').body('sender_id').optional().isLength({ max: 11 })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      const { phone_number, message, sender_id } = req.body;
      const result = await SMSService.sendSMS(phone_number, message, { senderId: sender_id?.trim() });
      return result.success ? ApiResponse.success(res, result, 'SMS sent successfully') : ApiResponse.error(res, result.error || 'SMS failed', 400, { details: result.details });
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  })
);

router.post('/sms/bulk-send', verifyAdmin,
  [
    require('express-validator').body('recipients').isArray({ min: 1, max: 1000 }),
    require('express-validator').body('recipients.*').matches(/^(\+254|254|0)[17]\d{8}$/),
    require('express-validator').body('message').notEmpty().isLength({ max: 160 }),
    require('express-validator').body('sender_id').optional().isLength({ max: 11 })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      const { recipients, message, sender_id } = req.body;
      const result = await SMSService.sendBulkSMS(recipients, message, { senderId: sender_id });
      return ApiResponse.success(res, result, 'Bulk SMS operation completed');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  })
);

router.post('/notifications/bill-reminders', verifyAdmin,
  [
    require('express-validator').body('days_overdue').optional().isInt({ min: 1, max: 365 }),
    require('express-validator').body('customer_ids').optional().isArray(),
    require('express-validator').body('customer_ids.*').optional().isInt({ min: 1 })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      const { days_overdue = 1, customer_ids } = req.body;
      
      let overdueBills = customer_ids && customer_ids.length > 0 
        ? await Bill.rawQuery(`SELECT b.*, c.full_name, c.phone, c.account_number, c.email FROM bills b JOIN customers c ON b.customer_id = c.id WHERE b.status IN ('pending', 'overdue') AND b.due_date < DATE_SUB(CURDATE(), INTERVAL ? DAY) AND c.id IN (${customer_ids.map(() => '?').join(',')}) AND c.phone IS NOT NULL ORDER BY b.due_date ASC`, [days_overdue, ...customer_ids])
        : await Bill.rawQuery(`SELECT b.*, c.full_name, c.phone, c.account_number, c.email FROM bills b JOIN customers c ON b.customer_id = c.id WHERE b.status IN ('pending', 'overdue') AND b.due_date < DATE_SUB(CURDATE(), INTERVAL ? DAY) AND c.phone IS NOT NULL ORDER BY b.due_date ASC LIMIT 500`, [days_overdue]);

      if (overdueBills.length === 0) return ApiResponse.success(res, { sent: 0, recipients: [], message: 'No overdue bills found' }, 'No reminders to send');

      const customerBills = {};
      overdueBills.forEach(bill => {
        if (!customerBills[bill.customer_id]) {
          customerBills[bill.customer_id] = { customer: { id: bill.customer_id, full_name: bill.full_name, phone: bill.phone, account_number: bill.account_number, email: bill.email }, bills: [], total_amount: 0 };
        }
        customerBills[bill.customer_id].bills.push(bill);
        customerBills[bill.customer_id].total_amount += parseFloat(bill.total_amount);
      });

      const notificationResults = [];
      for (const customerData of Object.values(customerBills)) {
        try {
          const oldestBill = customerData.bills.sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
          const daysOverdue = Math.ceil((new Date() - new Date(oldestBill.due_date)) / (1000 * 60 * 60 * 24));
          const result = await SMSService.sendOverdueNotice(customerData.customer, oldestBill, 0);
          notificationResults.push({ customer_id: customerData.customer.id, customer_name: customerData.customer.full_name, phone: customerData.customer.phone, bills_count: customerData.bills.length, total_amount: customerData.total_amount, days_overdue: daysOverdue, notification_result: result });
        } catch (error) {
          notificationResults.push({ customer_id: customerData.customer.id, customer_name: customerData.customer.full_name, error: error.message });
        }
      }

      const successful = notificationResults.filter(r => r.notification_result?.success).length;
      return ApiResponse.success(res, { total_processed: notificationResults.length, successful_notifications: successful, failed_notifications: notificationResults.length - successful, results: notificationResults }, `Notifications processed`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  })
);

router.post('/notifications/payment-confirmations', verifyAdmin,
  [
    require('express-validator').body('payment_ids').isArray({ min: 1 }),
    require('express-validator').body('payment_ids.*').isInt({ min: 1 })
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      const { payment_ids } = req.body;
      const payments = await Bill.rawQuery(`SELECT p.*, c.full_name, c.phone, c.account_number, c.email FROM payments p JOIN customers c ON p.customer_id = c.id WHERE p.id IN (${payment_ids.map(() => '?').join(',')}) AND c.phone IS NOT NULL`, payment_ids);

      if (payments.length === 0) return ApiResponse.error(res, 'No valid payments found', 404);

      const notificationResults = [];
      for (const payment of payments) {
        try {
          const customer = { id: payment.customer_id, full_name: payment.full_name, phone: payment.phone, account_number: payment.account_number, email: payment.email };
          const result = await SMSService.sendPaymentConfirmation(customer, payment);
          notificationResults.push({ payment_id: payment.id, customer_name: payment.full_name, phone: payment.phone, amount: payment.amount, notification_result: result });
        } catch (error) {
          notificationResults.push({ payment_id: payment.id, customer_name: payment.full_name, error: error.message });
        }
      }

      const successful = notificationResults.filter(r => r.notification_result?.success).length;
      return ApiResponse.success(res, { total_processed: notificationResults.length, successful_notifications: successful, failed_notifications: notificationResults.length - successful, results: notificationResults }, `Notifications processed`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  })
);

router.get('/sms/delivery-status/:messageId', verifyAdmin,
  [require('express-validator').param('messageId').notEmpty()],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      const result = await SMSService.getDeliveryStatus(req.params.messageId);
      return result.success ? ApiResponse.success(res, result, 'Status retrieved') : ApiResponse.error(res, result.error, 400);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  })
);

router.post('/notifications/custom', verifyAdmin,
  [
    require('express-validator').body('customer_ids').isArray({ min: 1, max: 1000 }),
    require('express-validator').body('customer_ids.*').isInt({ min: 1 }),
    require('express-validator').body('message').notEmpty().isLength({ max: 160 }),
    require('express-validator').body('notification_type').optional().isIn(['sms', 'email', 'both'])
  ],
  handleValidationErrors,
  asyncHandler(async (req, res) => {
    try {
      const { customer_ids, message, notification_type = 'sms' } = req.body;
      const customers = await Customer.rawQuery(`SELECT id, full_name, phone, email, account_number FROM customers WHERE id IN (${customer_ids.map(() => '?').join(',')}) AND phone IS NOT NULL`, customer_ids);

      if (customers.length === 0) return ApiResponse.error(res, 'No valid customers found', 404);

      const notificationResults = [];
      if (notification_type === 'sms' || notification_type === 'both') {
        for (const customer of customers) {
          try {
            const result = await SMSService.sendSMS(customer.phone, message);
            notificationResults.push({ customer_id: customer.id, customer_name: customer.full_name, phone: customer.phone, type: 'sms', notification_result: result });
          } catch (error) {
            notificationResults.push({ customer_id: customer.id, customer_name: customer.full_name, type: 'sms', error: error.message });
          }
        }
      }

      const successful = notificationResults.filter(r => r.notification_result?.success).length;
      return ApiResponse.success(res, { total_processed: notificationResults.length, successful_notifications: successful, failed_notifications: notificationResults.length - successful, notification_type, results: notificationResults }, `Notifications processed`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  })
);

// ===== ACTIVITY & MONITORING =====

router.get('/activity-log', verifyAdmin,
  [
    require('express-validator').query('page').optional().isInt({ min: 1 }),
    require('express-validator').query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidationErrors,
  asyncHandler(AdminController.getActivityLog)
);

router.get('/system-health', verifyAdmin, asyncHandler(AdminController.getSystemHealth));

module.exports = router;