const { Admin, Customer, Bill, Payment } = require('../models');
const AuthUtils = require('../utils/auth');
const ApiResponse = require('../utils/response');
const { executeQuery } = require('../config/database');

/**
 * Admin Controller - Handles admin authentication and management operations
 */
class AdminController {
  // Admin login
  static async login(req, res) {
    try {
      const { username, password } = req.body;
      const admin = await Admin.authenticateAdmin(username, password);
      const token = AuthUtils.generateToken({
        id: admin.id,
        username: admin.username,
        type: 'admin'
      });

      return ApiResponse.success(res, {
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          full_name: admin.full_name
        },
        token,
        expires_in: process.env.JWT_EXPIRE || '24h'
      }, 'Login successful');
    } catch (error) {
      return ApiResponse.error(res, error.message, 401);
    }
  }

  // Get admin profile
  static async getProfile(req, res) {
    try {
      const admin = req.admin;
      return ApiResponse.success(res, {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        full_name: admin.full_name,
        is_active: admin.is_active,
        last_login: admin.last_login
      }, 'Profile retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update admin profile
  static async updateProfile(req, res) {
    try {
      const adminId = req.admin.id;
      const updatedAdmin = await Admin.updateProfile(adminId, req.body);
      return ApiResponse.success(res, updatedAdmin, 'Profile updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Change admin password
  static async changePassword(req, res) {
    try {
      const adminId = req.admin.id;
      const { current_password, new_password } = req.body;
      const admin = await Admin.findById(adminId);
      const isValidPassword = await AuthUtils.comparePassword(current_password, admin.password_hash);

      if (!isValidPassword) {
        return ApiResponse.error(res, 'Current password is incorrect', 400);
      }

      await Admin.changePassword(adminId, new_password);
      return ApiResponse.success(res, null, 'Password changed successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get dashboard statistics (Updated to match new UI layout)
  static async getDashboard(req, res) {
    try {
      const stats = await Admin.getDashboardStats();
      return ApiResponse.success(res, stats, 'Dashboard data retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Comprehensive dashboard (Powers the revamped React Dashboard)
  static async getDashboardComprehensive(req, res) {
    try {
      const { period = '30d' } = req.query;
      const data = await Admin.getComprehensiveDashboard(period);
      return ApiResponse.success(res, data, 'Comprehensive dashboard data retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get revenue analytics
  static async getRevenueAnalytics(req, res) {
    try {
      const { period = 'monthly' } = req.query;
      const analytics = await Admin.getRevenueAnalytics(period);
      return ApiResponse.success(res, { period, analytics }, 'Revenue analytics retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customers with outstanding balances
  static async getOutstandingCustomers(req, res) {
    try {
      const { limit = 50 } = req.query;
      const customers = await Admin.getOutstandingCustomers(parseInt(limit));
      return ApiResponse.success(res, { customers, count: customers.length }, 'Outstanding customers retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get financial summary
  static async getFinancialSummary(req, res) {
    try {
      const { period = 'monthly' } = req.query;
      const [revenueAnalytics, paymentStats, billingStats] = await Promise.all([
        Admin.getRevenueAnalytics(period),
        Payment.getPaymentStats(period),
        Bill.getBillingStats(period)
      ]);

      return ApiResponse.success(res, {
        period,
        revenue: revenueAnalytics,
        payments: paymentStats,
        billing: billingStats,
        summary: {
          total_revenue: revenueAnalytics.reduce((sum, item) => sum + item.total_amount, 0),
          total_transactions: paymentStats.reduce((sum, item) => sum + item.transaction_count, 0),
          average_success_rate: paymentStats.length > 0 ? 
            (paymentStats.reduce((sum, item) => sum + parseFloat(item.success_rate), 0) / paymentStats.length).toFixed(2) : 0
        }
      }, 'Financial summary retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Export customer data
  static async exportCustomers(req, res) {
    try {
      const { format = 'json', status } = req.query;
      const filters = {};
      if (status) filters.is_active = status === 'active';

      const customers = await Customer.findAll(filters, { orderBy: 'created_at DESC' });
      const customersWithBalance = await Promise.all(
        customers.map(async (customer) => await Customer.getCustomerWithBalance(customer.id))
      );

      if (format === 'csv') {
        const csv = [
          'Account Number,Name,Phone,Email,Location,Connection Date,Status,Outstanding Bills,Outstanding Fines,Outstanding Contributions,Total Balance',
          ...customersWithBalance.map(c => 
            `${c.account_number},"${c.full_name}",${c.phone},"${c.email || ''}","${c.location}",${c.connection_date},${c.is_active ? 'Active' : 'Inactive'},${c.outstanding_bills},${c.outstanding_fines},${c.outstanding_contributions},${c.total_balance}`
          )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=customers.csv');
        return res.send(csv);
      }

      return ApiResponse.success(res, {
        customers: customersWithBalance,
        count: customersWithBalance.length,
        exported_at: new Date().toISOString()
      }, 'Customer data exported');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // System Health Check
  static async getSystemHealth(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: { database: 'healthy', payment_gateway: 'active', api_services: 'running', backup: 'scheduled' }
      };

      try {
        await executeQuery('SELECT 1');
      } catch (e) {
        health.checks.database = 'unhealthy';
        health.status = 'critical';
      }

      const failures = await executeQuery(`
        SELECT COUNT(*) as count FROM payment_logs 
        WHERE status = 'failed' AND timestamp > DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `);
      if (failures[0] && failures[0].count > 5) {
        health.checks.payment_gateway = 'degraded';
        health.status = 'warning';
      }

      return ApiResponse.success(res, health, 'System health retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Activity Log
  static async getActivityLog(req, res) {
    try {
      const query = `
        (SELECT 'payment' as type, CONCAT('Payment received from ', c.full_name) as title, CONCAT('KES ', p.amount) as subtitle, p.payment_date as timestamp, 'green' as color
         FROM payments p JOIN customers c ON p.customer_id = c.id ORDER BY p.payment_date DESC LIMIT 5)
        UNION ALL
        (SELECT 'customer' as type, 'New customer registered' as title, CONCAT(c.full_name, ' (', c.account_number, ')') as subtitle, c.created_at as timestamp, 'blue' as color
         FROM customers c ORDER BY c.created_at DESC LIMIT 5)
        UNION ALL
        (SELECT 'bill' as type, 'Bill generated' as title, CONCAT('Bill #', b.bill_number) as subtitle, b.generated_at as timestamp, 'yellow' as color
         FROM bills b ORDER BY b.generated_at DESC LIMIT 5)
        ORDER BY timestamp DESC LIMIT 10
      `;
      const activities = await executeQuery(query);
      return ApiResponse.success(res, { activities }, 'Activity log retrieved');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = AdminController;