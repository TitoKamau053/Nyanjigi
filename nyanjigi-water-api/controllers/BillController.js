const { Bill, Customer, SystemSettings } = require('../models');
const ApiResponse = require('../utils/response');
const moment = require('moment');
const NotificationService = require('../services/NotificationService');

/**
 * Bill Controller - Handles billing operations and management
 */
class BillController {
  // Generate monthly bills (Admin only)
  static async generateMonthlyBills(req, res) {
    try {
      const { billing_month, customer_ids } = req.body;

      if (!billing_month) {
        return ApiResponse.error(res, 'Billing month is required', 400);
      }

      // Validate billing month format
      const billingDate = moment(billing_month);
      if (!billingDate.isValid()) {
        return ApiResponse.error(res, 'Invalid billing month format. Use YYYY-MM-DD', 400);
      }

      const result = await Bill.generateMonthlyBills(billing_month, customer_ids);

      let smsSummary = null;
      if (result.notifications && result.notifications.length > 0) {
        const dispatch = await NotificationService.sendBillingCycleMessages(result.notifications);
        smsSummary = dispatch.summary;
      }

      delete result.notifications;

      return ApiResponse.success(res, {
        ...result,
        sms_summary: smsSummary
      },
        `Successfully generated ${result.generated_count} bills for ${billingDate.format('MMMM YYYY')}`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Generate bill for a specific customer (Admin only)
  static async generateCustomerBill(req, res) {
    try {
      const { customerId } = req.params;
      const { billing_month } = req.body;

      if (!billing_month) {
        return ApiResponse.error(res, 'Billing month is required', 400);
      }

      // Validate billing month format
      const billingDate = moment(billing_month);
      if (!billingDate.isValid()) {
        return ApiResponse.error(res, 'Invalid billing month format. Use YYYY-MM-DD', 400);
      }

      // Check if customer exists
      const customer = await Customer.findById(parseInt(customerId));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      const result = await Bill.generateMonthlyBills(billing_month, [parseInt(customerId)]);

      let smsSummary = null;
      if (result.notifications && result.notifications.length > 0) {
        const dispatch = await NotificationService.sendBillingCycleMessages(result.notifications);
        smsSummary = dispatch.summary;
      }

      delete result.notifications;

      return ApiResponse.success(res, {
        ...result,
        sms_summary: smsSummary
      },
        `Successfully generated bill for customer ${customer.full_name} for ${billingDate.format('MMMM YYYY')}`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get all bills with pagination and filters (Admin only)
  static async getAllBills(req, res) {
    try {
      const {
        page = 1,
        limit = 50,
        customer_id,
        status,
        billing_month,
        overdue,
        search
      } = req.query;

      const filters = {};
      if (customer_id) filters.customer_id = parseInt(customer_id);
      if (status) filters.status = status;
      if (billing_month) filters.billing_month = billing_month;
      if (overdue === 'true') filters.overdue = true;
      if (search) filters.search = search;

      const result = await Bill.getBillsWithPagination(
        parseInt(page),
        parseInt(limit),
        filters
      );

      return ApiResponse.success(res, result, 'Bills retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get specific bill details
  static async getBillDetails(req, res) {
    try {
      const { billId } = req.params;
      const bill = await Bill.getBillWithCustomer(parseInt(billId));

      if (!bill) {
        return ApiResponse.notFound(res, 'Bill not found');
      }

      return ApiResponse.success(res, bill, 'Bill details retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update bill status (Admin only)
  static async updateBillStatus(req, res) {
    try {
      const { billId } = req.params;
      const { status } = req.body;

      const validStatuses = ['pending', 'paid', 'overdue', 'partially_paid'];
      if (!validStatuses.includes(status)) {
        return ApiResponse.error(res, 'Invalid bill status', 400);
      }

      const paidAt = status === 'paid' ? new Date() : null;
      const updatedBill = await Bill.updateBillStatus(parseInt(billId), status, paidAt);

      if (!updatedBill) {
        return ApiResponse.notFound(res, 'Bill not found');
      }

      return ApiResponse.success(res, updatedBill, 'Bill status updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get overdue bills (Admin only)
  static async getOverdueBills(req, res) {
    try {
      const { limit = 50 } = req.query;
      const overdueBills = await Bill.getOverdueBills(parseInt(limit));

      const totalOverdue = overdueBills.reduce((sum, bill) => sum + parseFloat(bill.total_amount), 0);

      return ApiResponse.success(res, {
        bills: overdueBills,
        count: overdueBills.length,
        total_amount: totalOverdue
      }, 'Overdue bills retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get billing statistics
  static async getBillingStats(req, res) {
    try {
      const { period = 'monthly' } = req.query;
      const stats = await Bill.getBillingStats(period);

      // Calculate totals for all bills regardless of period
      const totalPaidAmountResult = await Bill.rawQuery(`
        SELECT COALESCE(SUM(total_amount), 0) as total_paid_amount
        FROM bills
        WHERE status = 'paid'
      `);

      const totalPendingAmountResult = await Bill.rawQuery(`
        SELECT COALESCE(SUM(total_amount), 0) as total_pending_amount
        FROM bills
        WHERE status = 'pending'
      `);

      const totalOverdueAmountResult = await Bill.rawQuery(`
        SELECT COALESCE(SUM(total_amount), 0) as total_overdue_amount
        FROM bills
        WHERE status = 'overdue'
      `);

      const totalPaidAmount = parseFloat(totalPaidAmountResult[0].total_paid_amount);
      const totalPendingAmount = parseFloat(totalPendingAmountResult[0].total_pending_amount);
      const totalOverdueAmount = parseFloat(totalOverdueAmountResult[0].total_overdue_amount);

      return ApiResponse.success(res, {
        period,
        statistics: stats,
        summary: {
          total_periods: stats.length,
          average_bills_per_period: stats.length > 0 ? 
            (stats.reduce((sum, s) => sum + s.bills_generated, 0) / stats.length).toFixed(0) : 0,
          average_collection_rate: stats.length > 0 ? 
            (stats.reduce((sum, s) => sum + parseFloat(s.collection_rate), 0) / stats.length).toFixed(2) : 0,
          total_paid_amount: totalPaidAmount,
          total_pending_amount: totalPendingAmount,
          total_overdue_amount: totalOverdueAmount
        }
      }, 'Billing statistics retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer billing history (Admin or Customer)
  static async getCustomerBills(req, res) {
    try {
      const { customerId } = req.params;
      const { page = 1, limit = 50 } = req.query;

      // Check if customer exists
      const customer = await Customer.findById(parseInt(customerId));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      // If accessing as customer, verify ownership
      if (req.customer && req.customer.id !== parseInt(customerId)) {
        return ApiResponse.forbidden(res, 'Cannot access other customer bills');
      }

      const result = await Bill.getCustomerBills(
        parseInt(customerId),
        parseInt(page),
        parseInt(limit)
      );

      return ApiResponse.success(res, result, 'Customer bills retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer bill summary
  static async getCustomerBillSummary(req, res) {
    try {
      const { customerId } = req.params;

      // Check if customer exists
      const customer = await Customer.findById(parseInt(customerId));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      // If accessing as customer, verify ownership
      if (req.customer && req.customer.id !== parseInt(customerId)) {
        return ApiResponse.forbidden(res, 'Cannot access other customer data');
      }

      const summary = await Bill.getCustomerBillSummary(parseInt(customerId));

      return ApiResponse.success(res, {
        customer: {
          id: customer.id,
          account_number: customer.account_number,
          full_name: customer.full_name
        },
        bill_summary: summary
      }, 'Customer bill summary retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Bulk bill status update (Admin only)
  static async bulkUpdateBillStatus(req, res) {
    try {
      const { bill_ids, status } = req.body;

      if (!Array.isArray(bill_ids) || bill_ids.length === 0) {
        return ApiResponse.error(res, 'Bill IDs array is required', 400);
      }

      const validStatuses = ['pending', 'paid', 'overdue', 'partially_paid'];
      if (!validStatuses.includes(status)) {
        return ApiResponse.error(res, 'Invalid bill status', 400);
      }

      const results = [];
      const errors = [];

      for (const billId of bill_ids) {
        try {
          const paidAt = status === 'paid' ? new Date() : null;
          const updatedBill = await Bill.updateBillStatus(parseInt(billId), status, paidAt);
          
          if (updatedBill) {
            results.push({
              bill_id: billId,
              status: 'updated',
              new_status: status
            });
          } else {
            errors.push({
              bill_id: billId,
              error: 'Bill not found'
            });
          }
        } catch (error) {
          errors.push({
            bill_id: billId,
            error: error.message
          });
        }
      }

      return ApiResponse.success(res, {
        updated: results,
        errors: errors,
        summary: {
          total_processed: bill_ids.length,
          successful_updates: results.length,
          failed_updates: errors.length
        }
      }, 'Bulk bill status update completed');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Generate bill preview (Admin only)
  static async generateBillPreview(req, res) {
    try {
      const { customer_id, billing_month } = req.body;

      if (!customer_id || !billing_month) {
        return ApiResponse.error(res, 'Customer ID and billing month are required', 400);
      }

      const customer = await Customer.getCustomerWithBalance(parseInt(customer_id));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      // Get billing settings
      const billingSettings = await SystemSettings.getBillingSettings();
      const billingDate = moment(billing_month);

      // Calculate due date as end of previous month + 5 days
      const previousMonthEnd = billingDate.clone().subtract(1, 'month').endOf('month');
      const dueDate = previousMonthEnd.clone().add(5, 'days').format('YYYY-MM-DD');

      const preview = {
        customer: {
          id: customer.id,
          account_number: customer.account_number,
          full_name: customer.full_name,
          phone: customer.phone
        },
        billing_period: {
          start: billingDate.clone().startOf('month').format('YYYY-MM-DD'),
          end: billingDate.clone().endOf('month').format('YYYY-MM-DD'),
          month_year: billingDate.format('MMMM YYYY')
        },
        amounts: {
          previous_balance: parseFloat(customer.outstanding_bills),
          current_charges: billingSettings.flat_rate,
          total_amount: parseFloat(customer.outstanding_bills) + billingSettings.flat_rate
        },
        due_date: dueDate,
        bill_type: 'flat_rate'
      };

      return ApiResponse.success(res, preview, 'Bill preview generated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get monthly billing summary (Admin only)
  static async getMonthlyBillingSummary(req, res) {
    try {
      const { year, month } = req.query;
      
      let targetDate;
      if (year && month) {
        targetDate = moment().year(parseInt(year)).month(parseInt(month) - 1);
      } else {
        targetDate = moment();
      }

      const startDate = targetDate.clone().startOf('month').format('YYYY-MM-DD');
      const endDate = targetDate.clone().endOf('month').format('YYYY-MM-DD');

      const summary = await Bill.rawQuery(`
        SELECT 
          COUNT(*) as total_bills,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_bills,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bills,
          COUNT(CASE WHEN status = 'overdue' OR (due_date < CURDATE() AND status != 'paid') THEN 1 END) as overdue_bills,
          SUM(total_amount) as total_billed,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as total_collected,
          AVG(total_amount) as average_bill_amount
        FROM bills 
        WHERE billing_period_start >= ? AND billing_period_start <= ?
      `, [startDate, endDate]);

      const monthlyData = summary[0];
      const collectionRate = monthlyData.total_bills > 0 ? 
        ((monthlyData.paid_bills / monthlyData.total_bills) * 100).toFixed(2) : 0;

      return ApiResponse.success(res, {
        period: {
          month: targetDate.format('MMMM'),
          year: targetDate.year(),
          start_date: startDate,
          end_date: endDate
        },
        summary: {
          total_bills: monthlyData.total_bills,
          paid_bills: monthlyData.paid_bills,
          pending_bills: monthlyData.pending_bills,
          overdue_bills: monthlyData.overdue_bills,
          total_billed: parseFloat(monthlyData.total_billed || 0),
          total_collected: parseFloat(monthlyData.total_collected || 0),
          average_bill_amount: parseFloat(monthlyData.average_bill_amount || 0),
          collection_rate: collectionRate,
          outstanding_amount: parseFloat(monthlyData.total_billed || 0) - parseFloat(monthlyData.total_collected || 0)
        }
      }, 'Monthly billing summary retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Export bills data (Admin only)
  static async exportBills(req, res) {
    try {
      const { 
        format = 'json', 
        status, 
        billing_month,
        customer_id 
      } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (billing_month) filters.billing_month = billing_month;
      if (customer_id) filters.customer_id = parseInt(customer_id);

      // Get all bills matching filters (without pagination for export)
      const result = await Bill.getBillsWithPagination(1, 10000, filters);
      const bills = result.bills;

      if (format === 'csv') {
        const csv = [
          'Bill Number,Customer Account,Customer Name,Billing Period,Total Amount,Status,Due Date,Generated Date',
          ...bills.map(bill => 
            `${bill.bill_number},${bill.account_number},"${bill.customer_name}","${moment(bill.billing_period_start).format('MMM YYYY')}",${bill.total_amount},${bill.status},${moment(bill.due_date).format('YYYY-MM-DD')},${moment(bill.generated_at).format('YYYY-MM-DD')}`
          )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=bills.csv');
        return res.send(csv);
      }

      return ApiResponse.success(res, {
        bills,
        count: bills.length,
        filters: filters,
        exported_at: new Date().toISOString()
      }, 'Bills data exported successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update bill statuses manually (Admin only)
  static async updateBillStatuses(req, res) {
    try {
      const updatedCount = await Bill.updateBillStatuses();
      
      return ApiResponse.success(res, {
        updated_count: updatedCount
      }, `Successfully updated ${updatedCount} bills from pending to overdue`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Delete bill (Admin only - use with caution)
  static async deleteBill(req, res) {
    try {
      const { billId } = req.params;
      const { confirm } = req.body;

      if (!confirm) {
        return ApiResponse.error(res, 'Deletion must be confirmed by setting confirm: true', 400);
      }

      // Check if bill has payments
      const bill = await Bill.findById(parseInt(billId));
      if (!bill) {
        return ApiResponse.notFound(res, 'Bill not found');
      }

      // Check for payment allocations
      const allocations = await Bill.rawQuery(
        'SELECT id FROM payment_allocations WHERE bill_id = ?',
        [billId]
      );

      if (allocations.length > 0) {
        return ApiResponse.error(res, 
          'Cannot delete bill with payment allocations. Contact system administrator.', 
          400
        );
      }

      const deleted = await Bill.delete(parseInt(billId));

      if (deleted) {
        return ApiResponse.success(res, null, 'Bill deleted successfully');
      } else {
        return ApiResponse.error(res, 'Failed to delete bill', 500);
      }
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = BillController;