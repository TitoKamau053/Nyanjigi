const { Admin, Customer, Bill, Payment } = require('../models');
const AuthUtils = require('../utils/auth');
const ApiResponse = require('../utils/response');

/**
 * Admin Controller - Handles admin authentication and management operations
 */
class AdminController {
  // Admin login
  static async login(req, res) {
    try {
      const { username, password } = req.body;

      // Authenticate admin
      const admin = await Admin.authenticateAdmin(username, password);

      // Generate JWT token
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
      const updateData = req.body;

      const updatedAdmin = await Admin.updateProfile(adminId, updateData);

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

      // Verify current password
      const admin = await Admin.findById(adminId);
      const isValidPassword = await AuthUtils.comparePassword(current_password, admin.password_hash);

      if (!isValidPassword) {
        return ApiResponse.error(res, 'Current password is incorrect', 400);
      }

      // Update password
      await Admin.changePassword(adminId, new_password);

      return ApiResponse.success(res, null, 'Password changed successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get dashboard statistics
  static async getDashboard(req, res) {
    try {
      const stats = await Admin.getDashboardStats();
      return ApiResponse.success(res, stats, 'Dashboard data retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get revenue analytics
  static async getRevenueAnalytics(req, res) {
    try {
      const { period = 'monthly' } = req.query;
      const analytics = await Admin.getRevenueAnalytics(period);

      return ApiResponse.success(res, {
        period,
        analytics
      }, 'Revenue analytics retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customers with outstanding balances
  static async getOutstandingCustomers(req, res) {
    try {
      const { limit = 50 } = req.query;
      const customers = await Admin.getOutstandingCustomers(parseInt(limit));

      return ApiResponse.success(res, {
        customers,
        count: customers.length
      }, 'Outstanding customers retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get system overview
  static async getSystemOverview(req, res) {
    try {
      const [
        dashboardStats,
        customerStats,
        recentPayments,
        overdueBills
      ] = await Promise.all([
        Admin.getDashboardStats(),
        Customer.getCustomerStats(),
        Payment.getPaymentsWithPagination(1, 10, { status: 'completed' }),
        Bill.getOverdueBills(10)
      ]);

      return ApiResponse.success(res, {
        dashboard: dashboardStats,
        customers: customerStats,
        recent_payments: recentPayments.payments,
        overdue_bills: overdueBills
      }, 'System overview retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get financial summary
  static async getFinancialSummary(req, res) {
    try {
      const { period = 'monthly' } = req.query;
      
      const [
        revenueAnalytics,
        paymentStats,
        billingStats
      ] = await Promise.all([
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
      }, 'Financial summary retrieved successfully');
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

      // Add balance information to each customer
      const customersWithBalance = await Promise.all(
        customers.map(async (customer) => {
          const customerWithBalance = await Customer.getCustomerWithBalance(customer.id);
          return customerWithBalance;
        })
      );

      if (format === 'csv') {
        // Convert to CSV format
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
      }, 'Customer data exported successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get admin activity log
  static async getActivityLog(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // This would require an audit_logs table implementation
      // For now, return recent admin actions based on updated records
      const recentActivities = await Admin.rawQuery(`
        SELECT 
          'customer_created' as action,
          c.full_name as target,
          c.created_at as timestamp,
          'Created new customer' as description
        FROM customers c
        WHERE c.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        
        UNION ALL
        
        SELECT 
          'bill_generated' as action,
          CONCAT(cust.full_name, ' - ', b.bill_number) as target,
          b.generated_at as timestamp,
          'Generated monthly bill' as description
        FROM bills b
        JOIN customers cust ON b.customer_id = cust.id
        WHERE b.generated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        
        ORDER BY timestamp DESC
        LIMIT ${parseInt(offset)}, ${parseInt(limit)}
      `);

      const totalCount = await Admin.rawQuery(`
        SELECT COUNT(*) as total FROM (
          SELECT created_at FROM customers WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
          UNION ALL
          SELECT generated_at FROM bills WHERE generated_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ) as activities
      `);

      return ApiResponse.success(res, {
        activities: recentActivities,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: totalCount[0].total,
          total_pages: Math.ceil(totalCount[0].total / limit)
        }
      }, 'Activity log retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get system health check
  static async getSystemHealth(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'healthy',
          customers: 'healthy',
          billing: 'healthy',
          payments: 'healthy'
        },
        statistics: {}
      };

      // Check database connectivity
      try {
        await Admin.rawQuery('SELECT 1 as test');
        health.checks.database = 'healthy';
      } catch (error) {
        health.checks.database = 'unhealthy';
        health.status = 'degraded';
      }

      // Check for recent customer activity
      try {
        const recentCustomers = await Customer.count({ 
          created_at: { '>=': new Date(Date.now() - 24 * 60 * 60 * 1000) }
        });
        health.statistics.new_customers_24h = recentCustomers;
      } catch (error) {
        health.checks.customers = 'degraded';
      }

      // Check for overdue bills
      try {
        const overdueBills = await Bill.getOverdueBills(1);
        health.statistics.overdue_bills = overdueBills.length;
        if (overdueBills.length > 100) {
          health.checks.billing = 'warning';
        }
      } catch (error) {
        health.checks.billing = 'degraded';
      }

      // Check recent payment activity
      try {
        const recentPayments = await Payment.getPaymentsWithPagination(1, 1, {
          date_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        health.statistics.payments_24h = recentPayments.pagination.total;
      } catch (error) {
        health.checks.payments = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 207 : 503;

      return ApiResponse.success(res, health, 'System health check completed', statusCode);
    } catch (error) {
      return ApiResponse.error(res, 'System health check failed', 503);
    }
  }
}

module.exports = AdminController;