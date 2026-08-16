const { Customer, Bill, Payment, Contribution, Fine } = require('../models');
const AuthUtils = require('../utils/auth');
const ApiResponse = require('../utils/response');
const SMSService = require('../services/SMSService');
const { executeQuery } = require('../config/database');

/**
 * Customer Controller - Handles customer authentication and account management
 */
class CustomerController {
  static async applyManualPaymentAllocation(customerId, paymentId, amount, referenceType = 'general') {
    try {
      const EquityController = require('./EquityController');
      return await EquityController.allocatePayment(paymentId, customerId, parseFloat(amount), referenceType);
    } catch (error) {
      console.error('[CustomerController] Manual payment allocation failed:', error);
      throw error;
    }
  }

  // Customer login
  static async login(req, res) {
    try {
      const { account_number, password } = req.body;

      // Authenticate customer
      const customer = await Customer.authenticateCustomer(account_number, password);

      // Generate JWT token
      const token = AuthUtils.generateToken({
        id: customer.id,
        account_number: customer.account_number,
        type: 'customer'
      });

      return ApiResponse.success(res, {
        customer: {
          id: customer.id,
          account_number: customer.account_number,
          full_name: customer.full_name,
          phone: customer.phone,
          email: customer.email,
          zone: customer.zone
        },
        token,
        expires_in: process.env.JWT_EXPIRE || '24h'
      }, 'Login successful');
    } catch (error) {
      return ApiResponse.error(res, error.message, 401);
    }
  }

  // Get customer dashboard
  static async getDashboard(req, res) {
    try {
      const customerId = req.customer.id;
      const dashboard = await Customer.getCustomerDashboard(customerId);

      return ApiResponse.success(res, dashboard, 'Dashboard data retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer profile
  static async getProfile(req, res) {
    try {
      const customerId = req.customer.id;
      const customer = await Customer.getCustomerWithBalance(customerId);

      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      return ApiResponse.success(res, {
        id: customer.id,
        account_number: customer.account_number,
        full_name: customer.full_name,
        phone: customer.phone,
        email: customer.email,
        location: customer.location,
        zone: customer.zone,
        meter_number: customer.meter_number,
        connection_date: customer.connection_date,
        is_active: customer.is_active,
        balance: {
          outstanding_bills: customer.outstanding_bills,
          outstanding_fines: customer.outstanding_fines,
          outstanding_contributions: customer.outstanding_contributions,
          total_balance: customer.total_balance
        }
      }, 'Profile retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update customer profile (limited fields)
  static async updateProfile(req, res) {
    try {
      const customerId = req.customer.id;
      const { phone, email } = req.body;

      const updateData = {};
      if (phone) updateData.phone = phone;
      if (email) updateData.email = email;

      const updatedCustomer = await Customer.updateCustomer(customerId, updateData);

      return ApiResponse.success(res, {
        id: updatedCustomer.id,
        account_number: updatedCustomer.account_number,
        full_name: updatedCustomer.full_name,
        phone: updatedCustomer.phone,
        email: updatedCustomer.email
      }, 'Profile updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Change customer password
  static async changePassword(req, res) {
    try {
      const customerId = req.customer.id;
      const { current_password, new_password } = req.body;

      // Get customer with password hash
      const customer = await Customer.findById(customerId);

      if (!customer.password_hash) {
        return ApiResponse.error(res, 'Password not set. Contact admin for password setup.', 400);
      }

      const isValidPassword = await AuthUtils.comparePassword(current_password, customer.password_hash);

      if (!isValidPassword) {
        return ApiResponse.error(res, 'Current password is incorrect', 400);
      }

      await Customer.changePassword(customerId, new_password);

      return ApiResponse.success(res, null, 'Password changed successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer bills
  static async getBills(req, res) {
    try {
      let customerId;

      // If called as customer, use authenticated customer ID
      if (req.customer) {
        customerId = req.customer.id;
      }
      // If called as admin with customerId param, use that
      else if (req.params.customerId) {
        customerId = parseInt(req.params.customerId);
      }
      else {
        return ApiResponse.error(res, 'Customer ID required', 400);
      }

      const { page = 1, limit = 10 } = req.query;
      const result = await Bill.getCustomerBills(customerId, parseInt(page), parseInt(limit));

      return ApiResponse.success(res, result, 'Bills retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get specific bill details
  static async getBillDetails(req, res) {
    try {
      const customerId = req.customer.id;
      const { billId } = req.params;

      const bill = await Bill.getBillWithCustomer(billId);

      if (!bill || bill.customer_id !== customerId) {
        return ApiResponse.notFound(res, 'Bill not found');
      }

      return ApiResponse.success(res, bill, 'Bill details retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer payments
  static async getPayments(req, res) {
    try {
      const customerId = req.customer.id;
      const { page = 1, limit = 10 } = req.query;

      const result = await Payment.getCustomerPayments(customerId, parseInt(page), parseInt(limit));

      return ApiResponse.success(res, result, 'Payments retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get specific payment details
  static async getPaymentDetails(req, res) {
    try {
      const customerId = req.customer.id;
      const { paymentId } = req.params;

      const payment = await Payment.getPaymentWithAllocations(paymentId);

      if (!payment || payment.customer_id !== customerId) {
        return ApiResponse.notFound(res, 'Payment not found');
      }

      return ApiResponse.success(res, payment, 'Payment details retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer contributions
  static async getContributions(req, res) {
    try {
      const customerId = req.customer.id;
      const { page = 1, limit = 10 } = req.query;

      const result = await Contribution.getCustomerContributions(customerId, parseInt(page), parseInt(limit));

      return ApiResponse.success(res, result, 'Contributions retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer fines
  static async getFines(req, res) {
    try {
      const customerId = req.customer.id;
      const { page = 1, limit = 10 } = req.query;

      const result = await Fine.getAppliedFinesByCustomer(customerId, parseInt(page), parseInt(limit));

      return ApiResponse.success(res, result, 'Fines retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get zone financial breakdown for dashboard stats
  static async getZoneFinancialSummary(req, res) {
    try {
      const summary = await Customer.getZoneFinancialSummary();
      return ApiResponse.success(res, summary, 'Zone financial summary retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
  
  // Get customer account summary
  static async getAccountSummary(req, res) {
    try {
      const customerId = req.customer.id;

      const [
        billSummary,
        contributionSummary,
        recentPayments
      ] = await Promise.all([
        Bill.getCustomerBillSummary(customerId),
        Contribution.getCustomerContributionSummary(customerId),
        Payment.getCustomerPayments(customerId, 1, 5)
      ]);

      const totalOutstanding =
        billSummary.outstanding_amount +
        contributionSummary.outstanding_amount;

      const totalPaid =
        billSummary.total_paid +
        contributionSummary.total_paid;

      return ApiResponse.success(res, {
        account_summary: {
          total_outstanding: totalOutstanding,
          total_paid: totalPaid,
          account_status: totalOutstanding > 0 ? 'outstanding' : 'current'
        },
        bills: billSummary,
        contributions: contributionSummary,
        recent_payments: recentPayments.payments
      }, 'Account summary retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // ADMIN FUNCTIONS FOR CUSTOMER MANAGEMENT

  // Create new customer (Admin only)
  static async createCustomer(req, res) {
    try {
      const { initial_balance, ...customerData } = req.body; // Extract initial_balance
      const newCustomer = await Customer.createCustomer(customerData);

      const { plain_password, ...customerResponse } = newCustomer;

      //  HANDLE INITIAL BALANCE
      if (initial_balance && parseFloat(initial_balance) !== 0) {
        const amount = parseFloat(initial_balance);
        const date = new Date().toISOString().slice(0, 10);

        if (amount > 0) {
          // POSITIVE: It's a DEBT (Create a Bill)
          const billQuery = `
            INSERT INTO bills (
              customer_id, bill_number, billing_period_start, billing_period_end,
              current_charges, total_amount, due_date, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'Opening Balance - Debt')
          `;
          await executeQuery(billQuery, [
            newCustomer.id,
            `OPEN-${newCustomer.account_number}`, // Unique Bill Ref
            date, date, // Period
            amount, amount, // Amounts
            date // Due Immediately
          ]);

        } else {
          // NEGATIVE: It's a CREDIT (Create a Payment)
          const absAmount = Math.abs(amount);
          const paymentQuery = `
            INSERT INTO payments (
              customer_id, transaction_id, payment_method, amount, 
              payment_date, status, notes
            ) VALUES (?, ?, 'manual_entry', ?, NOW(), 'completed', 'Opening Balance - Credit')
          `;
          
          const result = await executeQuery(paymentQuery, [
            newCustomer.id,
            `OPEN-${newCustomer.account_number}`,
            absAmount
          ]);

          // Allocate against outstanding bills first; only allow advance if no debt remains
          await CustomerController.applyManualPaymentAllocation(
            newCustomer.id,
            result.insertId,
            absAmount,
            'general'
          );
        }
      }
      //END INITIAL BALANCE

      // Send SMS with login credentials if customer has phone number
      if (customerResponse.phone && plain_password) {
        try {
          await SMSService.sendPasswordNotification(customerResponse, plain_password);
          console.log('Welcome SMS sent to customer:', customerResponse.phone);
        } catch (smsError) {
          console.error('Failed to send welcome SMS:', smsError.message);
          // Don't fail the customer creation if SMS fails
        }
      }

      return ApiResponse.success(res, {
        customer: customerResponse,
        temporary_password: plain_password
      }, 'Customer created successfully', 201);

    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        if (error.message.includes('account_number')) {
            return ApiResponse.error(res, 'Account number already exists', 409);
        }
        if (error.message.includes('national_id')) {
            return ApiResponse.error(res, 'National ID already exists', 409);
        }
        return ApiResponse.error(res, 'Phone number or email already exists', 409);
      }
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Adjust Balance for Existing Customers
  static async adjustBalance(req, res) {
    try {
      const { customerId } = req.params;
      const { amount, notes } = req.body; // Amount: Positive = Add Debt, Negative = Add Credit

      if (!amount || parseFloat(amount) === 0) {
        return ApiResponse.error(res, 'Valid amount is required', 400);
      }

      const valAmount = parseFloat(amount);
      const customer = await Customer.findById(customerId);
      if (!customer) return ApiResponse.notFound(res, 'Customer not found');

      const timestamp = Date.now();
      const date = new Date().toISOString().slice(0, 10);

      if (valAmount > 0) {
        // ADD DEBT (Create Bill)
        const billQuery = `
            INSERT INTO bills (
              customer_id, bill_number, billing_period_start, billing_period_end,
              current_charges, total_amount, due_date, status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `;
        await executeQuery(billQuery, [
          customerId,
          `ADJ-DR-${customer.account_number}-${timestamp}`,
          date, date,
          valAmount, valAmount,
          date,
          notes || 'Manual Balance Adjustment (Debit)'
        ]);

      } else {
        // ADD CREDIT (Create Payment)
        const absAmount = Math.abs(valAmount);
        const paymentQuery = `
            INSERT INTO payments (
              customer_id, transaction_id, payment_method, amount, 
              payment_date, status, notes
            ) VALUES (?, ?, 'manual_entry', ?, NOW(), 'completed', ?)
        `;
        const result = await executeQuery(paymentQuery, [
          customerId,
          `ADJ-CR-${customer.account_number}-${timestamp}`,
          absAmount,
          notes || 'Manual Balance Adjustment (Credit)'
        ]);

        // Allocate against outstanding bills first; only create an advance if no debt remains
        await CustomerController.applyManualPaymentAllocation(
          customerId,
          result.insertId,
          absAmount,
          'general'
        );
      }

      return ApiResponse.success(res, null, 'Balance adjusted successfully');

    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
  // Get all customers (Admin only)
  static async getAllCustomers(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        search = '',
        status = '',
        sort = 'desc'
      } = req.query;

      const result = await Customer.getCustomersWithPagination(
        parseInt(page),
        parseInt(limit),
        search,
        status
      );

      return ApiResponse.success(res, result, 'Customers retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get specific customer (Admin only)
  static async getCustomerById(req, res) {
    try {
      const { customerId } = req.params;
      const customer = await Customer.getCustomerWithBalance(parseInt(customerId));

      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      return ApiResponse.success(res, customer, 'Customer details retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update customer (Admin only, supports soft delete)
  static async updateCustomer(req, res) {
    try {
      const { customerId } = req.params;
      const updateData = req.body;

      // Soft delete logic
      if (updateData.deleted === true) {
        const updatedCustomer = await Customer.updateCustomer(parseInt(customerId), { deleted: true });
        if (!updatedCustomer) {
          return ApiResponse.notFound(res, 'Customer not found');
        }
        return ApiResponse.success(res, updatedCustomer, 'Customer soft deleted successfully');
      }

      const updatedCustomer = await Customer.updateCustomer(parseInt(customerId), updateData);

      if (!updatedCustomer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      return ApiResponse.success(res, updatedCustomer, 'Customer updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Reset customer password (Admin only)
  static async resetPassword(req, res) {
    try {
      const { customerId } = req.params;
      const { new_password } = req.body;

      let password = new_password;
      if (!password) {
        password = AuthUtils.generateRandomPassword();
      }

      await Customer.changePassword(parseInt(customerId), password);

      return ApiResponse.success(res, {
        customer_id: customerId,
        new_password: password // Only returned to admin
      }, 'Password reset successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Toggle customer status (Admin only)
  static async toggleStatus(req, res) {
    try {
      const { id } = req.params;

      const customer = await Customer.findById(parseInt(id));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      const newStatus = !customer.is_active;
      const updatedCustomer = await Customer.updateCustomer(parseInt(id), {
        is_active: newStatus
      });
      
      return ApiResponse.success(res, updatedCustomer,
        `Customer ${newStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer statistics (Admin only)
  static async getCustomerStats(req, res) {
    try {
      const stats = await Customer.getCustomerStats();
      return ApiResponse.success(res, stats, 'Customer statistics retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Search customers (Admin only)
  static async searchCustomers(req, res) {
    try {
      const { q } = req.query;

      if (!q || q.length < 2) {
        return ApiResponse.error(res, 'Search query must be at least 2 characters', 400);
      }

      const customers = await Customer.findAll({}, {
        // This would need a custom implementation in the model for full-text search
        orderBy: 'full_name ASC',
        limit: 20
      });

      // Filter results (this is simplified - in production you'd use database full-text search)
      const filteredCustomers = customers.filter(customer =>
        customer.full_name.toLowerCase().includes(q.toLowerCase()) ||
        customer.account_number.toLowerCase().includes(q.toLowerCase()) ||
        customer.phone.includes(q)
      );

      return ApiResponse.success(res, {
        customers: filteredCustomers.map(c => ({
          id: c.id,
          account_number: c.account_number,
          full_name: c.full_name,
          phone: c.phone,
          zone: c.zone,
          is_active: c.is_active
        })),
        count: filteredCustomers.length
      }, 'Search completed successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = CustomerController;
