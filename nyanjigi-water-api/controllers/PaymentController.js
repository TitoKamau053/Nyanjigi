const { Payment } = require('../models');
const ApiResponse = require('../utils/response');

class PaymentController {
  /**
   * Get payment methods information
   */
  static async getPaymentMethods(req, res) {
    try {
      const paymentMethods = {
        equity_external: {
          name: 'Equity Bank External Payment',
          description: 'Pay through any Equity Bank channel',
          channels: [
            {
              id: 'branch',
              name: 'Branch Deposit',
              description: 'Cash deposits at any Equity Bank branch nationwide'
            },
            {
              id: 'agent',
              name: 'Agent Deposit',
              description: 'Pay through authorized Equity Bank agents'
            },
            {
              id: 'mpesa',
              name: 'M-Pesa Paybill',
              description: 'Use M-Pesa paybill number 247247',
              paybill: '247247'
            },
            {
              id: 'equitel',
              name: 'Equitel Line',
              description: 'Pay directly via Equitel mobile line'
            },
            {
              id: 'ussd',
              name: 'USSD Code',
              description: 'Dial *247# to make payment',
              code: '*247#'
            },
            {
              id: 'app',
              name: 'Equity Mobile App',
              description: 'Pay through Equity mobile banking application'
            }
          ],
          currency: 'KES',
          minimum_amount: 1,
          fees: 'Transaction fees as per Equity Bank charges',
          integration_status: 'active',
          instructions: [
            '1. Choose any payment channel above',
            '2. Provide your account number when prompted',
            '3. Enter the amount to pay',
            '4. Complete the payment',
            '5. Your account will be updated automatically'
          ]
        }
      };

      return ApiResponse.success(res, paymentMethods, 'Payment methods retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Get all payments (Admin)
   */
static async getAllPayments(req, res) {
  try {
    const {
      page = 1,
      limit = 20,
      customer_id,
      status,
      date_from,
      date_to,
      search
    } = req.query;

    const filters = {};
    if (customer_id) filters.customer_id = parseInt(customer_id);
    if (status) filters.status = status;
    if (date_from) filters.date_from = date_from;
    if (date_to) filters.date_to = date_to;
    if (search) filters.search = search;

    const result = await Payment.getPaymentsWithPagination(
      parseInt(page),
      parseInt(limit),
      filters
    );

    return ApiResponse.success(res, result, 'Payments retrieved successfully');
  } catch (error) {
    console.error('Get all payments error:', error); // Add logging
    return ApiResponse.error(res, error.message, 500);
  }
}

  /**
   * Get payment details
   */
  static async getPaymentDetails(req, res) {
    try {
      const { paymentId } = req.params;
      const payment = await Payment.getPaymentWithAllocations(parseInt(paymentId));

      if (!payment) {
        return ApiResponse.notFound(res, 'Payment not found');
      }

      // Check access
      if (req.customer && payment.customer_id !== req.customer.id) {
        return ApiResponse.forbidden(res, 'Access denied');
      }

      return ApiResponse.success(res, payment, 'Payment details retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Get payment statistics (Admin)
   */
  static async getPaymentStats(req, res) {
    try {
      const { period = 'monthly' } = req.query;
      const stats = await Payment.getPaymentStats(period);

      return ApiResponse.success(res, {
        period,
        statistics: stats
      }, 'Payment statistics retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  static async getPaymentStatus(req, res) {
  try {
    const { transactionId } = req.params;
    
    const query = `
      SELECT 
        p.*,
        c.account_number,
        c.full_name as customer_name
      FROM payments p
      LEFT JOIN customers c ON p.customer_id = c.id
      WHERE p.transaction_id = ? OR p.equity_reference = ?
    `;
    
    const { executeQuery } = require('../config/database');
    const payment = await executeQuery(query, [transactionId, transactionId]);
    
    if (!payment || payment.length === 0) {
      return ApiResponse.notFound(res, 'Payment not found');
    }
    
    return ApiResponse.success(res, payment[0], 'Payment status retrieved');
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
}
}

module.exports = PaymentController;