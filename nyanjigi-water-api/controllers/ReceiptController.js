const { Receipt, Customer } = require('../models');
const ApiResponse = require('../utils/response');

/**
 * Receipt Controller - Handles payment receipt operations
 */
class ReceiptController {
  /**
   * Get all receipts with filters (Admin only)
   */
  static async getAllReceipts(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        customer_id,
        payment_type,
        date_from,
        date_to,
        search
      } = req.query;

      const filters = {};
      if (customer_id) filters.customer_id = parseInt(customer_id);
      if (payment_type) filters.payment_type = payment_type;
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;
      if (search) filters.search = search;

      const result = await Receipt.getReceiptsWithPagination(
        parseInt(page),
        parseInt(limit),
        filters
      );

      return ApiResponse.success(res, result, 'Receipts retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Get receipt by ID
   */
  static async getReceiptById(req, res) {
    try {
      const { receiptId } = req.params;

      const receipt = await Receipt.getReceiptWithDetails(parseInt(receiptId));

      if (!receipt) {
        return ApiResponse.notFound(res, 'Receipt not found');
      }

      return ApiResponse.success(res, receipt, 'Receipt retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Get customer receipts
   */
  static async getCustomerReceipts(req, res) {
    try {
      const { customerId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Verify customer exists
      const customer = await Customer.findById(parseInt(customerId));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      // If customer is accessing, ensure they can only access their own receipts
      if (req.customer && req.customer.id !== parseInt(customerId)) {
        return ApiResponse.forbidden(res, 'Cannot access other customer receipts');
      }

      const result = await Receipt.getCustomerReceipts(
        parseInt(customerId),
        parseInt(page),
        parseInt(limit)
      );

      return ApiResponse.success(res, result, 'Customer receipts retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Get receipt summary statistics
   */
  static async getReceiptSummary(req, res) {
    try {
      const { date_from, date_to } = req.query;

      const filters = {};
      if (date_from) filters.date_from = date_from;
      if (date_to) filters.date_to = date_to;

      const summary = await Receipt.getReceiptSummary(filters);

      return ApiResponse.success(res, summary, 'Receipt summary retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Search receipts
   */
  static async searchReceipts(req, res) {
    try {
      const { q, limit = 20 } = req.query;

      if (!q) {
        return ApiResponse.error(res, 'Search term is required', 400);
      }

      const receipts = await Receipt.searchReceipts(q, parseInt(limit));

      return ApiResponse.success(res, {
        receipts,
        count: receipts.length
      }, 'Receipts search completed');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  /**
   * Get receipt summary for customer
   */
  static async getCustomerReceiptSummary(req, res) {
    try {
      const { customerId } = req.params;

      // Verify customer exists
      const customer = await Customer.findById(parseInt(customerId));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      // If customer is accessing, ensure they can only access their own data
      if (req.customer && req.customer.id !== parseInt(customerId)) {
        return ApiResponse.forbidden(res, 'Cannot access other customer data');
      }

      // Get receipts and calculate summary
      const result = await Receipt.getCustomerReceipts(
        parseInt(customerId),
        1,
        1000 // Get all receipts for summary
      );

      const receipts = result.receipts;
      const summary = {
        total_receipts: receipts.length,
        total_amount_paid: 0,
        by_type: {}
      };

      receipts.forEach(receipt => {
        summary.total_amount_paid += parseFloat(receipt.amount);
        if (!summary.by_type[receipt.payment_type]) {
          summary.by_type[receipt.payment_type] = {
            count: 0,
            total: 0
          };
        }
        summary.by_type[receipt.payment_type].count += 1;
        summary.by_type[receipt.payment_type].total += parseFloat(receipt.amount);
      });

      return ApiResponse.success(res, {
        customer: {
          id: customer.id,
          account_number: customer.account_number,
          full_name: customer.full_name
        },
        summary
      }, 'Customer receipt summary retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = ReceiptController;
