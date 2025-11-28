const BaseModel = require('./BaseModel');
const { executeQuery } = require('../config/database');
const AuthUtils = require('../utils/auth');

/**
 * Admin Model
 */
class Admin extends BaseModel {
  constructor() {
    super('admins');
  }

  // Create admin
  async createAdmin(adminData) {
    try {
      const hashedPassword = await AuthUtils.hashPassword(adminData.password);
      
      const data = {
        username: adminData.username,
        email: adminData.email,
        password_hash: hashedPassword,
        full_name: adminData.full_name,
        is_active: true
      };

      const admin = await this.create(data);
      
      // Remove password hash from response
      const { password_hash, ...adminResponse } = admin;
      return adminResponse;
    } catch (error) {
      console.error('Error creating admin:', error);
      throw error;
    }
  }

  // Find admin by username
  async findByUsername(username) {
    try {
      return await this.findOne({ username: username });
    } catch (error) {
      console.error('Error finding admin by username:', error);
      throw error;
    }
  }

  // Find admin by email
  async findByEmail(email) {
    try {
      return await this.findOne({ email: email });
    } catch (error) {
      console.error('Error finding admin by email:', error);
      throw error;
    }
  }

  // Authenticate admin login
  async authenticateAdmin(username, password) {
    try {
      const admin = await this.findByUsername(username);
      
      if (!admin) {
        throw new Error('Invalid username or password');
      }

      if (!admin.is_active) {
        throw new Error('Account is deactivated');
      }

      const isValidPassword = await AuthUtils.comparePassword(password, admin.password_hash);
      
      if (!isValidPassword) {
        throw new Error('Invalid username or password');
      }

      // Remove password from returned object
      const { password_hash, ...adminData } = admin;
      return adminData;
    } catch (error) {
      console.error('Error authenticating admin:', error);
      throw error;
    }
  }

  // Change admin password
  async changePassword(adminId, newPassword) {
    try {
      const hashedPassword = await AuthUtils.hashPassword(newPassword);
      return await this.update(adminId, { password_hash: hashedPassword });
    } catch (error) {
      console.error('Error changing admin password:', error);
      throw error;
    }
  }

  // Update admin profile
  async updateProfile(adminId, updateData) {
    try {
      // Remove sensitive fields that shouldn't be updated directly
      const allowedFields = ['full_name', 'email'];
      
      const filteredData = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      const admin = await this.update(adminId, filteredData);
      
      // Remove password hash from response
      const { password_hash, ...adminResponse } = admin;
      return adminResponse;
    } catch (error) {
      console.error('Error updating admin profile:', error);
      throw error;
    }
  }

  // Get admin dashboard statistics
  async getDashboardStats() {
    try {
      const queries = [
        // Total customers
        'SELECT COUNT(*) as total FROM customers WHERE is_active = TRUE',
        
        // Total outstanding bills
        `SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(total_amount), 0) as amount 
         FROM bills 
         WHERE status IN ('pending', 'overdue')`,
        
        // Today's payments
        `SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(amount), 0) as amount 
         FROM payments 
         WHERE DATE(payment_date) = CURDATE() AND status = 'completed'`,
        
        // This month's collections
        `SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(amount), 0) as amount 
         FROM payments 
         WHERE YEAR(payment_date) = YEAR(CURDATE()) 
         AND MONTH(payment_date) = MONTH(CURDATE()) 
         AND status = 'completed'`,
        
        // Overdue bills
        `SELECT 
          COUNT(*) as count, 
          COALESCE(SUM(total_amount), 0) as amount 
         FROM bills 
         WHERE due_date < CURDATE() AND status != 'paid'`,
        
        // Recent bills generated
        `SELECT COUNT(*) as count 
         FROM bills 
         WHERE DATE(generated_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
      ];

      const [
        totalCustomers,
        outstandingBills,
        todayPayments,
        monthlyCollections,
        overdueBills,
        recentBills
      ] = await Promise.all(queries.map(query => executeQuery(query)));

      return {
        total_customers: totalCustomers[0].total,
        outstanding_bills: {
          count: outstandingBills[0].count,
          amount: parseFloat(outstandingBills[0].amount)
        },
        today_payments: {
          count: todayPayments[0].count,
          amount: parseFloat(todayPayments[0].amount)
        },
        monthly_collections: {
          count: monthlyCollections[0].count,
          amount: parseFloat(monthlyCollections[0].amount)
        },
        overdue_bills: {
          count: overdueBills[0].count,
          amount: parseFloat(overdueBills[0].amount)
        },
        recent_bills_count: recentBills[0].count
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  // Get revenue analytics
  async getRevenueAnalytics(period = 'monthly') {
    try {
      let dateFormat, dateRange, days;

      // Handle new period formats (7d, 30d, 90d)
      switch (period) {
        case '7d':
          days = 7;
          dateFormat = '%Y-%m-%d';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
          break;
        case '30d':
          days = 30;
          dateFormat = '%Y-%m-%d';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          break;
        case '90d':
          days = 90;
          dateFormat = '%Y-%m-%d';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
          break;
        case 'daily':
          days = 30;
          dateFormat = '%Y-%m-%d';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          break;
        case 'weekly':
          days = 12;
          dateFormat = '%Y-%u';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 WEEK)';
          break;
        case 'yearly':
          days = 365;
          dateFormat = '%Y';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 5 YEAR)';
          break;
        default: // monthly
          days = 12;
          dateFormat = '%Y-%m';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
      }

      const query = `
        SELECT
          DATE_FORMAT(payment_date, '${dateFormat}') as period,
          COUNT(*) as transaction_count,
          SUM(amount) as total_amount,
          AVG(amount) as average_amount
        FROM payments
        WHERE payment_date >= ${dateRange}
        AND status = 'completed'
        GROUP BY DATE_FORMAT(payment_date, '${dateFormat}')
        ORDER BY period ASC
      `;

      const analytics = await executeQuery(query);

      return analytics.map(row => ({
        period: row.period,
        transaction_count: row.transaction_count,
        total_amount: parseFloat(row.total_amount),
        average_amount: parseFloat(row.average_amount)
      }));
    } catch (error) {
      console.error('Error getting revenue analytics:', error);
      throw error;
    }
  }

  // Get financial summary
  async getFinancialSummary(period = 'monthly') {
    try {
      let dateRange, days;

      // Handle new period formats (7d, 30d, 90d)
      switch (period) {
        case '7d':
          days = 7;
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
          break;
        case '30d':
          days = 30;
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          break;
        case '90d':
          days = 90;
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 90 DAY)';
          break;
        case 'daily':
          days = 30;
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          break;
        case 'weekly':
          days = 12;
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 WEEK)';
          break;
        case 'yearly':
          days = 365;
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 5 YEAR)';
          break;
        default: // monthly
          days = 12;
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
      }

      // Get payment method breakdown
      const paymentMethodsQuery = `
        SELECT
          payment_method,
          COUNT(*) as count,
          SUM(amount) as total
        FROM payments
        WHERE payment_date >= ${dateRange}
        AND status = 'completed'
        GROUP BY payment_method
      `;

      const paymentMethods = await executeQuery(paymentMethodsQuery);

      // Get billing statistics
      const billingStatsQuery = `
        SELECT
          status,
          COUNT(*) as count,
          SUM(total_amount) as total
        FROM bills
        WHERE generated_at >= ${dateRange}
        GROUP BY status
      `;

      const billingStats = await executeQuery(billingStatsQuery);

      // Get contribution statistics
      const contributionStatsQuery = `
        SELECT
          status,
          COUNT(*) as count,
          SUM(amount_required) as total
        FROM contributions
        WHERE created_at >= ${dateRange}
        GROUP BY status
      `;

      const contributionStats = await executeQuery(contributionStatsQuery);

      // Format payment methods
      const formattedPaymentMethods = paymentMethods.map(method => ({
        method: method.payment_method === 'mpesa' ? 'M-Pesa' :
                method.payment_method === 'bank' ? 'Bank Transfer' : 'Cash',
        count: method.count,
        total: parseFloat(method.total)
      }));

      // Format billing stats
      const formattedBillingStats = billingStats.map(stat => ({
        status: stat.status,
        count: stat.count,
        total: parseFloat(stat.total)
      }));

      // Format contribution stats
      const formattedContributionStats = contributionStats.map(stat => ({
        status: stat.status,
        count: stat.count,
        total: parseFloat(stat.total)
      }));

      return {
        payment_methods: formattedPaymentMethods,
        billing_stats: formattedBillingStats,
        contribution_stats: formattedContributionStats,
        period: period,
        period_days: days
      };
    } catch (error) {
      console.error('Error getting financial summary:', error);
      throw error;
    }
  }

  // Get customers with outstanding balances
async getOutstandingCustomers(limit = 50) {
  try {
    const limitInt = parseInt(limit); // Parse to integer
    
    const query = `
      SELECT 
        c.id,
        c.account_number,
        c.full_name,
        c.phone,
        COALESCE(SUM(b.total_amount), 0) as outstanding_bills,
        COALESCE(SUM(f.amount), 0) as outstanding_fines,
        COALESCE(SUM(cont.amount_required - cont.amount_paid), 0) as outstanding_contributions,
        (COALESCE(SUM(b.total_amount), 0) + 
         COALESCE(SUM(f.amount), 0) + 
         COALESCE(SUM(cont.amount_required - cont.amount_paid), 0)) as total_outstanding
      FROM customers c
      LEFT JOIN bills b ON c.id = b.customer_id AND b.status != 'paid'
      LEFT JOIN applied_fines f ON c.id = f.customer_id AND f.status != 'paid'
      LEFT JOIN contributions cont ON c.id = cont.customer_id AND cont.status != 'completed'
      WHERE c.is_active = TRUE
      GROUP BY c.id, c.account_number, c.full_name, c.phone
      HAVING total_outstanding > 0
      ORDER BY total_outstanding DESC
      LIMIT ${limitInt}
    `;

    const customers = await executeQuery(query); // Remove [limit] parameter
    
    return customers.map(customer => ({
      ...customer,
      outstanding_bills: parseFloat(customer.outstanding_bills),
      outstanding_fines: parseFloat(customer.outstanding_fines),
      outstanding_contributions: parseFloat(customer.outstanding_contributions),
      total_outstanding: parseFloat(customer.total_outstanding)
    }));
  } catch (error) {
    console.error('Error getting outstanding customers:', error);
    throw error;
  }
}
}

module.exports = new Admin();