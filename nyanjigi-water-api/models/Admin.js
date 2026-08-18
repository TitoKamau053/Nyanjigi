const BaseModel = require('./BaseModel');
const Customer = require('./Customer');
const { executeQuery } = require('../config/database');
const AuthUtils = require('../utils/auth');

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
      const { password_hash, ...adminResponse } = admin;
      return adminResponse;
    } catch (error) {
      console.error('Error creating admin:', error);
      throw error;
    }
  }

  // Find admin by username
  async findByUsername(username) {
    return await this.findOne({ username: username });
  }

  // Find admin by email
  async findByEmail(email) {
    return await this.findOne({ email: email });
  }

  // Authenticate admin login
  async authenticateAdmin(username, password) {
    const admin = await this.findByUsername(username);
    if (!admin) throw new Error('Invalid username or password');
    if (!admin.is_active) throw new Error('Account is deactivated');

    const isValidPassword = await AuthUtils.comparePassword(password, admin.password_hash);
    if (!isValidPassword) throw new Error('Invalid username or password');

    const { password_hash, ...adminData } = admin;
    return adminData;
  }

  // Change admin password
  async changePassword(adminId, newPassword) {
    const hashedPassword = await AuthUtils.hashPassword(newPassword);
    return await this.update(adminId, { password_hash: hashedPassword });
  }

  // Update admin profile
  async updateProfile(adminId, updateData) {
    const allowedFields = ['full_name', 'email'];
    const filteredData = {};
    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) filteredData[key] = updateData[key];
    });

    const admin = await this.update(adminId, filteredData);
    const { password_hash, ...adminResponse } = admin;
    return adminResponse;
  }

  // Get admin dashboard statistics (UPDATED FOR NEW UI)
  async getDashboardStats() {
    try {
      // 1. Current Month Collections
      const [currentMonthRes] = await executeQuery(`
        SELECT COALESCE(SUM(amount), 0) as total FROM payments 
        WHERE MONTH(payment_date) = MONTH(CURDATE()) 
        AND YEAR(payment_date) = YEAR(CURDATE()) AND status = 'completed'
      `);

      // 2. Last Month Collections (For Growth)
      const [lastMonthRes] = await executeQuery(`
        SELECT COALESCE(SUM(amount), 0) as total FROM payments 
        WHERE MONTH(payment_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) 
        AND YEAR(payment_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH)) AND status = 'completed'
      `);

      // 3. Outstanding Bills
      const [outstandingBillsRes] = await executeQuery(`
        SELECT COALESCE(SUM(b.total_amount - COALESCE(pa.paid, 0)), 0) as total
        FROM bills b
        LEFT JOIN (
          SELECT bill_id, SUM(amount) AS paid
          FROM payment_allocations
          WHERE allocation_type = 'bill_payment'
          GROUP BY bill_id
        ) pa ON pa.bill_id = b.id
        WHERE b.status IN ('pending', 'overdue', 'partially_paid')
      `);

      // 4. Pending Contributions
      const [pendingContribRes] = await executeQuery(`
        SELECT COALESCE(SUM(amount_required - amount_paid), 0) as total FROM contributions WHERE status != 'completed'
      `);

      // 5. Active Customers
      const [activeCustRes] = await executeQuery(`
        SELECT COUNT(id) as count FROM customers WHERE is_active = TRUE
      `);

      // 6. Recent Payments
      const recentPayments = await executeQuery(`
        SELECT 
          p.id, c.full_name as customer, c.account_number as account, 
          p.amount, p.payment_method as type, p.payment_date as date, p.status
        FROM payments p
        JOIN customers c ON p.customer_id = c.id
        ORDER BY p.payment_date DESC LIMIT 5
      `);

      // 7. Payment Distribution (Using real data ratios if available, or fallback percentages)
      const distributionRes = await executeQuery(`
        SELECT payment_method as type, COALESCE(SUM(amount), 0) as total 
        FROM payments WHERE status = 'completed' GROUP BY payment_method
      `);

      const totalRevenue = parseFloat(currentMonthRes?.total || 0);
      const lastMonthRev = parseFloat(lastMonthRes?.total || 1);
      const revenueGrowth = (((totalRevenue - lastMonthRev) / lastMonthRev) * 100).toFixed(1);

      // Map distribution correctly
      let waterTotal = 0, contribTotal = 0, fineTotal = 0;
      distributionRes.forEach(d => {
        const amt = parseFloat(d.total);
        if (d.type.toLowerCase().includes('bank') || d.type.toLowerCase().includes('mpesa')) waterTotal += amt;
        else if (d.type.toLowerCase().includes('cash')) contribTotal += amt; // Mock mapping for visual distribution
      });
      
      const totalDist = (waterTotal + contribTotal + fineTotal) || 1;

      return {
        metrics: {
          totalRevenue,
          revenueGrowth: parseFloat(revenueGrowth),
          outstandingBills: parseFloat(outstandingBillsRes?.total || 0),
          pendingContributions: parseFloat(pendingContribRes?.total || 0),
          activeCustomers: activeCustRes?.count || 0
        },
        distribution: {
          waterBills: waterTotal ? Math.round((waterTotal / totalDist) * 100) : 65,
          contributions: contribTotal ? Math.round((contribTotal / totalDist) * 100) : 25,
          fines: fineTotal ? Math.round((fineTotal / totalDist) * 100) : 10
        },
        recentPayments: recentPayments.map(p => ({
          id: `TRX-${p.id}`,
          customer: p.customer,
          account: p.account,
          amount: parseFloat(p.amount),
          type: 'Water Bill', // Default type unless you have a dedicated 'payment_for' column
          date: p.date,
          status: p.status
        }))
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
      switch (period) {
        case '7d': days = 7; dateFormat = '%Y-%m-%d'; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 7 DAY)'; break;
        case '30d': days = 30; dateFormat = '%Y-%m-%d'; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)'; break;
        case '90d': days = 90; dateFormat = '%Y-%m-%d'; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 90 DAY)'; break;
        case 'daily': days = 30; dateFormat = '%Y-%m-%d'; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)'; break;
        case 'weekly': days = 12; dateFormat = '%Y-%u'; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 WEEK)'; break;
        case 'yearly': days = 365; dateFormat = '%Y'; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 5 YEAR)'; break;
        default: days = 12; dateFormat = '%Y-%m'; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
      }

      const query = `
        SELECT DATE_FORMAT(payment_date, '${dateFormat}') as period, COUNT(*) as transaction_count,
               SUM(amount) as total_amount, AVG(amount) as average_amount
        FROM payments WHERE payment_date >= ${dateRange} AND status = 'completed'
        GROUP BY DATE_FORMAT(payment_date, '${dateFormat}') ORDER BY period ASC
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
      switch (period) {
        case '7d': days = 7; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 7 DAY)'; break;
        case '30d': days = 30; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)'; break;
        case '90d': days = 90; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 90 DAY)'; break;
        case 'daily': days = 30; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)'; break;
        case 'weekly': days = 12; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 WEEK)'; break;
        case 'yearly': days = 365; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 5 YEAR)'; break;
        default: days = 12; dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
      }

      const paymentMethods = await executeQuery(`SELECT payment_method, COUNT(*) as count, SUM(amount) as total FROM payments WHERE payment_date >= ${dateRange} AND status = 'completed' GROUP BY payment_method`);
      const billingStats = await executeQuery(`SELECT status, COUNT(*) as count, SUM(total_amount) as total FROM bills WHERE generated_at >= ${dateRange} GROUP BY status`);
      const contributionStats = await executeQuery(`SELECT status, COUNT(*) as count, SUM(amount_required) as total FROM contributions WHERE created_at >= ${dateRange} GROUP BY status`);

      return {
        payment_methods: paymentMethods.map(m => ({ method: m.payment_method, count: m.count, total: parseFloat(m.total) })),
        billing_stats: billingStats.map(s => ({ status: s.status, count: s.count, total: parseFloat(s.total) })),
        contribution_stats: contributionStats.map(s => ({ status: s.status, count: s.count, total: parseFloat(s.total) })),
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
      const query = `
        SELECT 
          c.id, c.account_number, c.full_name, c.phone,
          ${Customer.constructor.getOutstandingBillsSubquery('c.id')} as outstanding_bills,
          ${Customer.constructor.getOutstandingFinesSubquery('c.id')} as outstanding_fines,
          COALESCE((SELECT SUM(amount_required - amount_paid) FROM contributions WHERE customer_id = c.id AND status != 'completed'), 0) as outstanding_contributions,
          (
            ${Customer.constructor.getOutstandingBillsSubquery('c.id')} +
            ${Customer.constructor.getOutstandingFinesSubquery('c.id')} +
            COALESCE((SELECT SUM(amount_required - amount_paid) FROM contributions WHERE customer_id = c.id AND status != 'completed'), 0)
          ) as total_outstanding
        FROM customers c
        WHERE c.is_active = TRUE
        HAVING total_outstanding > 0
        ORDER BY total_outstanding DESC
        LIMIT ${parseInt(limit)}
      `;

      const customers = await executeQuery(query);
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

  /**
   * Comprehensive dashboard data: KPIs, revenue trend, distribution,
   * top/poor performers, and recent transactions — all in parallel.
   * Powers GET /api/v1/admin/dashboard-comprehensive
   */
  async getComprehensiveDashboard(period = '30d') {
    try {
      const trendConfig =  await this._resolveTrendConfig(period);

      const [
        currentMonthRes,
        lastMonthRes,
        outstandingBillsRes,
        pendingContribRes,
        activeCustRes,
        revenueTrend,
        distribution,
        topCustomers,
        poorPerformers,
        recentTransactions,
        collectionRateRes
      ] = await Promise.all([
        executeQuery(`
          SELECT COALESCE(SUM(amount), 0) as total FROM payments
          WHERE status = 'completed'
            AND MONTH(payment_date) = MONTH(CURDATE())
            AND YEAR(payment_date) = YEAR(CURDATE())
        `),
        executeQuery(`
          SELECT COALESCE(SUM(amount), 0) as total FROM payments
          WHERE status = 'completed'
            AND MONTH(payment_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
            AND YEAR(payment_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        `),
        executeQuery(`
          SELECT COALESCE(SUM(b.total_amount - COALESCE(pa.paid, 0)), 0) as total
          FROM bills b
          LEFT JOIN (
            SELECT bill_id, SUM(amount) AS paid
            FROM payment_allocations
            WHERE allocation_type = 'bill_payment'
            GROUP BY bill_id
          ) pa ON pa.bill_id = b.id
          WHERE b.status IN ('pending', 'overdue', 'partially_paid')
        `),
        executeQuery(`
          SELECT COALESCE(SUM(amount_required - amount_paid), 0) as total
          FROM contributions WHERE status != 'completed'
        `),
        executeQuery(`SELECT COUNT(id) as count FROM customers WHERE is_active = TRUE`),
        this._getRevenueTrend(trendConfig),
        this._getPaymentDistribution(trendConfig.dateRangeSql),
        this._getTopCustomers(5),
        this._getPoorPerformers(5),
        this._getRecentTransactions(10),
        this._getCollectionRate()
      ]);

      const totalRevenue = parseFloat(currentMonthRes[0]?.total || 0);
      const lastMonthRevenue = parseFloat(lastMonthRes[0]?.total || 0);

      let revenueGrowth = null;
      let revenueGrowthLabel = null;

      if (totalRevenue === 0 && lastMonthRevenue > 0) {
        revenueGrowthLabel = 'No collections yet this month';
      } else if (totalRevenue === 0 && lastMonthRevenue === 0) {
        revenueGrowthLabel = 'No collections in either period';
      } else if (lastMonthRevenue === 0 && totalRevenue > 0) {
        revenueGrowthLabel = 'First collections this month';
      } else {
        revenueGrowth = parseFloat((((totalRevenue - lastMonthRevenue) / lastMonthRevenue) * 100).toFixed(1));
      }

      const outstandingBills = parseFloat(outstandingBillsRes[0]?.total || 0);
      const pendingContributions = parseFloat(pendingContribRes[0]?.total || 0);
      const activeCustomers = activeCustRes[0]?.count || 0;

      return {
        metrics: {
          totalRevenue,
          revenueGrowth,
          revenueGrowthLabel,
          outstandingBills,
          pendingContributions,
          activeCustomers
        },
        systemHealth: {
          collectionRate: collectionRateRes.collectionRate,
          totalOutstanding: outstandingBills + pendingContributions,
          totalBilled: collectionRateRes.totalBilled,
          totalCollected: collectionRateRes.totalCollected
        },
        trendWindow: {
          anchorDate: trendConfig.anchorDate,
          isCurrent: trendConfig.anchorDate === new Date().toISOString().split('T')[0]
        },
        revenueTrend,         // [{ period, label, totalAmount, transactionCount }]
        distribution,         // { bills, contributions, fines, advance } (percentages + raw)
        topPerformers: topCustomers,
        poorPerformers,
        recentTransactions
      };
    } catch (error) {
      console.error('Error getting comprehensive dashboard:', error);
      throw error;
    }
  }

  /**
   *Trend window anchored to the most recent payment_date,
   * not CURDATE(). This means "last 30 days" reflects the last 30 days of
   * *actual activity*, so the chart isn't empty just because today happens
   * to fall after a lull in payments.
   */
  async _resolveTrendConfig(period) {
    const [latest] = await executeQuery(`
      SELECT MAX(DATE(payment_date)) as latest_date FROM payments WHERE status = 'completed'
    `);

    // The driver may return latest_date as a JS Date, a string, or null.
    // Normalize to a strict 'YYYY-MM-DD' string before it ever touches SQL.
    const anchorDate = this._toMysqlDateString(latest?.latest_date) || this._toMysqlDateString(new Date());

    let dateFormat, intervalDays;
    switch (period) {
      case '7d': intervalDays = 7; dateFormat = '%Y-%m-%d'; break;
      case '90d': intervalDays = 90; dateFormat = '%x-W%v'; break;
      case 'yearly': intervalDays = 365; dateFormat = '%Y-%m'; break;
      case '30d':
      default: intervalDays = 30; dateFormat = '%Y-%m-%d'; break;
    }

    return {
      dateFormat,
      anchorDate,
      dateRangeSql: `DATE_SUB('${anchorDate}', INTERVAL ${intervalDays} DAY)`,
      upperBoundSql: `'${anchorDate}'`
    };
  }

  /**
   * Normalizes a Date object, a MySQL-driver date string, or a Date-like
   * value into a strict 'YYYY-MM-DD' string safe to interpolate into SQL.
   * Returns null if the input can't be parsed.
   */
  _toMysqlDateString(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  async _getRevenueTrend({ dateFormat, dateRangeSql, upperBoundSql }) {
    const rows = await executeQuery(`
      SELECT
        DATE_FORMAT(payment_date, '${dateFormat}') as period_key,
        MIN(DATE(payment_date)) as period_start,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM payments
      WHERE status = 'completed'
        AND payment_date >= ${dateRangeSql}
        AND payment_date <= ${upperBoundSql}
      GROUP BY period_key
      ORDER BY period_start ASC
    `);

    return rows.map(row => ({
      period: row.period_key,
      label: this._formatTrendLabel(row.period_start),
      transactionCount: row.transaction_count,
      totalAmount: parseFloat(row.total_amount)
    }));
  }

  _formatTrendLabel(date) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /**
   * Real Bills vs Contributions vs Fines split, sourced from
   * payment_allocations.allocation_type — not inferred from payment_method.
   */
  async _getPaymentDistribution(dateRangeSql) {
    const rows = await executeQuery(`
      SELECT pa.allocation_type, COALESCE(SUM(pa.amount), 0) as total
      FROM payment_allocations pa
      JOIN payments p ON pa.payment_id = p.id
      WHERE p.status = 'completed' AND p.payment_date >= ${dateRangeSql}
      GROUP BY pa.allocation_type
    `);

    const raw = { bill_payment: 0, contribution: 0, fine: 0, advance: 0 };
    rows.forEach(r => { raw[r.allocation_type] = parseFloat(r.total); });

    const total = Object.values(raw).reduce((sum, v) => sum + v, 0) || 1;

    return {
      bills: { amount: raw.bill_payment, percent: Math.round((raw.bill_payment / total) * 100) },
      contributions: { amount: raw.contribution, percent: Math.round((raw.contribution / total) * 100) },
      fines: { amount: raw.fine, percent: Math.round((raw.fine / total) * 100) },
      advance: { amount: raw.advance, percent: Math.round((raw.advance / total) * 100) }
    };
  }

  /** Top 5 customers by total completed payment revenue */
  async _getTopCustomers(limit = 5) {
    const rows = await executeQuery(`
      SELECT
        c.id, c.account_number, c.full_name, c.zone,
        COUNT(p.id) as payment_count,
        SUM(p.amount) as total_paid
      FROM customers c
      JOIN payments p ON p.customer_id = c.id AND p.status = 'completed'
      GROUP BY c.id, c.account_number, c.full_name, c.zone
      ORDER BY total_paid DESC
      LIMIT ${parseInt(limit)}
    `);

    return rows.map(r => ({
      id: r.id,
      accountNumber: r.account_number,
      name: r.full_name,
      zone: r.zone,
      paymentCount: r.payment_count,
      totalPaid: parseFloat(r.total_paid)
    }));
  }

/** Top 5 customers by outstanding debt (bills + fines + contributions) */
  async _getPoorPerformers(limit = 5) {
    const rows = await executeQuery(`
      SELECT
        c.id, c.account_number, c.full_name, c.zone,
        ${Customer.constructor.getOutstandingBillsSubquery('c.id')} as outstanding_bills,
        ${Customer.constructor.getOutstandingFinesSubquery('c.id')} as outstanding_fines,
        COALESCE((SELECT SUM(amount_required - amount_paid) FROM contributions WHERE customer_id = c.id AND status != 'completed'), 0) as outstanding_contributions
      FROM customers c
      WHERE c.is_active = TRUE
      HAVING (outstanding_bills + outstanding_fines + outstanding_contributions) > 0
      ORDER BY (outstanding_bills + outstanding_fines + outstanding_contributions) DESC
      LIMIT ${parseInt(limit)}
    `);

    return rows.map(r => {
      const outstandingBills = parseFloat(r.outstanding_bills);
      const outstandingFines = parseFloat(r.outstanding_fines);
      const outstandingContributions = parseFloat(r.outstanding_contributions);
      return {
        id: r.id,
        accountNumber: r.account_number,
        name: r.full_name,
        zone: r.zone,
        outstandingBills,
        outstandingFines,
        outstandingContributions,
        totalDebt: outstandingBills + outstandingFines + outstandingContributions
      };
    });
  }

  /** Most recent system-wide transactions (payments) for the activity table */
  async _getRecentTransactions(limit = 10) {
    const rows = await executeQuery(`
      SELECT
        p.id, p.transaction_id, p.amount, p.payment_method,
        p.status, p.payment_date,
        c.full_name as customer_name, c.account_number
      FROM payments p
      JOIN customers c ON p.customer_id = c.id
      ORDER BY p.payment_date DESC
      LIMIT ${parseInt(limit)}
    `);

    return rows.map(r => ({
      id: `TRX-${r.id}`,
      transactionId: r.transaction_id,
      customer: r.customer_name,
      account: r.account_number,
      amount: parseFloat(r.amount),
      method: r.payment_method,
      status: r.status,
      date: r.payment_date
    }));
  }

  /** Collection rate = total collected / total billed (all-time, completed bills universe) */
  async _getCollectionRate() {
    const [billed] = await executeQuery(`SELECT COALESCE(SUM(total_amount), 0) as total FROM bills`);
    const [collected] = await executeQuery(`
      SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'completed'
    `);

    const totalBilled = parseFloat(billed?.total || 0);
    const totalCollected = parseFloat(collected?.total || 0);
    const collectionRate = totalBilled > 0
      ? parseFloat(((totalCollected / totalBilled) * 100).toFixed(1))
      : null;

    return { totalBilled, totalCollected, collectionRate };
  }
}

module.exports = new Admin();