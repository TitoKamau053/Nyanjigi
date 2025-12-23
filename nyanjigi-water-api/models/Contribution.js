const BaseModel = require('./BaseModel');
const { executeQuery } = require('../config/database');
const moment = require('moment');

/**
 * Contribution Model - Handles monthly uniform contributions
 */
class Contribution extends BaseModel {
  constructor() {
    super('contributions');
  }

  // Generate monthly contributions for all active customers
  async generateMonthlyContributions(contributionMonth, customerIds = null) {
    try {
      const monthDate = moment(contributionMonth);
      const firstDay = monthDate.clone().startOf('month').format('YYYY-MM-DD');
      
      // Get contribution settings
      const settingsQuery = `
        SELECT setting_key, setting_value 
        FROM system_settings 
        WHERE setting_key IN ('monthly_contribution_amount', 'contribution_due_days')
      `;
      const settings = await executeQuery(settingsQuery);
      const settingsMap = {};
      settings.forEach(s => settingsMap[s.setting_key] = s.setting_value);
      
      const contributionAmount = parseFloat(settingsMap.monthly_contribution_amount) || 100.00;
      const dueDays = parseInt(settingsMap.contribution_due_days) || 30;
      const dueDate = monthDate.clone().add(dueDays, 'days').format('YYYY-MM-DD');

      // Get customers to create contributions for
      let customerQuery = `
        SELECT id, account_number, full_name
        FROM customers
        WHERE is_active = TRUE
      `;
      
      const params = [];
      if (customerIds && customerIds.length > 0) {
        customerQuery += ` AND id IN (${customerIds.map(() => '?').join(',')})`;
        params.push(...customerIds);
      }

      // Check for existing contributions for this month
      customerQuery += `
        AND NOT EXISTS (
          SELECT 1 FROM contributions 
          WHERE customer_id = customers.id 
          AND contribution_month = ?
        )
      `;
      params.push(firstDay);

      const customers = await executeQuery(customerQuery, params);

      if (customers.length === 0) {
        return {
          generated_count: 0,
          message: 'No customers found or contributions already generated for this month'
        };
      }

      // Prepare contribution data for bulk insert
      const contributionsData = customers.map(customer => ({
        customer_id: customer.id,
        contribution_month: firstDay,
        amount_required: contributionAmount,
        amount_paid: 0.00,
        status: 'pending',
        due_date: dueDate
      }));

      // Bulk insert contributions
      await this.bulkInsert(contributionsData);

      return {
        generated_count: contributionsData.length,
        contribution_month: firstDay,
        amount_per_customer: contributionAmount,
        due_date: dueDate,
        total_expected: contributionsData.length * contributionAmount,
        customers_assigned: customers.map(c => ({
          id: c.id,
          account_number: c.account_number,
          name: c.full_name
        }))
      };
    } catch (error) {
      console.error('Error generating monthly contributions:', error);
      throw error;
    }
  }

  // Get contributions with pagination and filters
  async getContributionsWithPagination(page = 1, limit = 10, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      const conditions = [];
      const params = [];

      // Build WHERE conditions
      if (filters.customer_id) {
        conditions.push('cont.customer_id = ?');
        params.push(filters.customer_id);
      }

      if (filters.status) {
        conditions.push('cont.status = ?');
        params.push(filters.status);
      }

      if (filters.contribution_month) {
        const month = moment(filters.contribution_month);
        conditions.push('YEAR(cont.contribution_month) = ? AND MONTH(cont.contribution_month) = ?');
        params.push(month.year(), month.month() + 1);
      }

      if (filters.overdue) {
        conditions.push("cont.due_date < CURDATE() AND cont.status != 'completed'");
      }

      if (filters.search) {
        conditions.push(`(
          c.full_name LIKE ? OR 
          c.account_number LIKE ?
        )`);
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get contributions with customer info
      const contributionsQuery = `
        SELECT
          cont.*,
          c.account_number,
          c.full_name as customer_name,
          c.phone as customer_phone,
          (cont.amount_required - cont.amount_paid) as outstanding_amount,
          CASE
            WHEN cont.due_date < CURDATE() AND cont.status != 'completed' THEN 'overdue'
            ELSE cont.status
          END as display_status
        FROM contributions cont
        INNER JOIN customers c ON cont.customer_id = c.id
        ${whereClause}
        ORDER BY cont.contribution_month DESC, c.full_name ASC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const finalParams = [...params];
      console.log('Executing contributions query with params:', finalParams);
      const contributions = await executeQuery(contributionsQuery, finalParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM contributions cont
        INNER JOIN customers c ON cont.customer_id = c.id
        ${whereClause}
      `;
      const countResult = await executeQuery(countQuery, params);
      const total = countResult[0].total;

      return {
        contributions,
        pagination: {
          current_page: page,
          per_page: limit,
          total,
          total_pages: Math.ceil(total / limit),
          has_next: page < Math.ceil(total / limit),
          has_prev: page > 1
        }
      };
    } catch (error) {
      console.error('Error getting contributions with pagination:', error);
      throw error;
    }
  }

  // Get customer contributions
  async getCustomerContributions(customerId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const contributionsQuery = `
        SELECT *,
          (amount_required - amount_paid) as outstanding_amount,
          CASE
            WHEN due_date < CURDATE() AND status != 'completed' THEN 'overdue'
            ELSE status
          END as display_status
        FROM contributions
        WHERE customer_id = ?
        ORDER BY contribution_month DESC
        LIMIT ${offset}, ${limit}
      `;

      const finalParams = [customerId, limit, offset];
      console.log('Executing customer contributions query with params:', finalParams);
      const contributions = await executeQuery(contributionsQuery, finalParams);

      // Get total count
      const countQuery = 'SELECT COUNT(*) as total FROM contributions WHERE customer_id = ?';
      const countResult = await executeQuery(countQuery, [customerId]);
      const total = countResult[0].total;

      return {
        contributions,
        pagination: {
          current_page: page,
          per_page: limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting customer contributions:', error);
      throw error;
    }
  }

  // Process contribution payment
  async processContributionPayment(contributionId, paymentAmount, paymentId) {
    try {
      const contribution = await this.findById(contributionId);
      if (!contribution) {
        throw new Error('Contribution not found');
      }

      const newAmountPaid = parseFloat(contribution.amount_paid) + paymentAmount;
      const amountRequired = parseFloat(contribution.amount_required);
      
      let newStatus = 'partial';
      if (newAmountPaid >= amountRequired) {
        newStatus = 'completed';
      }

      // Update contribution
      const updateData = {
        amount_paid: newAmountPaid,
        status: newStatus
      };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date();
      }

      await this.update(contributionId, updateData);

      // Create payment allocation record
      const allocationQuery = `
        INSERT INTO payment_allocations (payment_id, allocation_type, amount, notes) 
        VALUES (?, 'contribution', ?, ?)
      `;
      const notes = `Contribution for ${moment(contribution.contribution_month).format('MMMM YYYY')}`;
      await executeQuery(allocationQuery, [paymentId, paymentAmount, notes]);

      return {
        contribution_id: contributionId,
        new_status: newStatus,
        amount_paid: paymentAmount,
        total_paid: newAmountPaid,
        remaining_amount: Math.max(0, amountRequired - newAmountPaid)
      };
    } catch (error) {
      console.error('Error processing contribution payment:', error);
      throw error;
    }
  }

  // Get contribution summary for a customer
  async getCustomerContributionSummary(customerId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_contributions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_contributions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_contributions,
          COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_contributions,
          COUNT(CASE WHEN status != 'completed' AND due_date < CURDATE() THEN 1 END) as overdue_contributions,
          COALESCE(SUM(amount_required - amount_paid), 0) as outstanding_amount,
          COALESCE(SUM(amount_paid), 0) as total_paid
        FROM contributions 
        WHERE customer_id = ?
      `;

      const result = await executeQuery(query, [customerId]);
      const summary = result[0];

      return {
        total_contributions: summary.total_contributions,
        completed_contributions: summary.completed_contributions,
        pending_contributions: summary.pending_contributions,
        partial_contributions: summary.partial_contributions,
        overdue_contributions: summary.overdue_contributions,
        outstanding_amount: parseFloat(summary.outstanding_amount),
        total_paid: parseFloat(summary.total_paid)
      };
    } catch (error) {
      console.error('Error getting customer contribution summary:', error);
      throw error;
    }
  }

  // Get monthly contribution statistics
  async getContributionStats(period = 'monthly') {
    try {
      let dateFormat, dateRange;
      
      switch (period) {
        case 'yearly':
          dateFormat = '%Y';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 5 YEAR)';
          break;
        default: // monthly
          dateFormat = '%Y-%m';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
      }

      const query = `
        SELECT 
          DATE_FORMAT(contribution_month, '${dateFormat}') as period,
          COUNT(*) as total_contributions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_contributions,
          SUM(amount_required) as total_expected,
          SUM(amount_paid) as total_collected,
          AVG(CASE WHEN status = 'completed' THEN amount_paid ELSE NULL END) as avg_payment
        FROM contributions 
        WHERE contribution_month >= ${dateRange}
        GROUP BY DATE_FORMAT(contribution_month, '${dateFormat}')
        ORDER BY period ASC
      `;

      const stats = await executeQuery(query);
      
      return stats.map(row => ({
        period: row.period,
        total_contributions: row.total_contributions,
        completed_contributions: row.completed_contributions,
        collection_rate: row.total_contributions > 0 ? 
          ((row.completed_contributions / row.total_contributions) * 100).toFixed(2) : 0,
        total_expected: parseFloat(row.total_expected),
        total_collected: parseFloat(row.total_collected),
        collection_percentage: row.total_expected > 0 ? 
          ((parseFloat(row.total_collected) / parseFloat(row.total_expected)) * 100).toFixed(2) : 0,
        average_payment: parseFloat(row.avg_payment || 0)
      }));
    } catch (error) {
      console.error('Error getting contribution stats:', error);
      throw error;
    }
  }

// Get overdue contributions
  async getOverdueContributions(limit = 100) {
    try {
      //Ensure limit is an integer and interpolated directly into the query
      const limitInt = parseInt(limit) || 100;

      const query = `
        SELECT 
          cont.*,
          c.account_number,
          c.full_name as customer_name,
          c.phone as customer_phone,
          (cont.amount_required - cont.amount_paid) as outstanding_amount,
          DATEDIFF(CURDATE(), cont.due_date) as days_overdue
        FROM contributions cont
        INNER JOIN customers c ON cont.customer_id = c.id
        WHERE cont.due_date < CURDATE() 
        AND cont.status != 'completed'
        AND c.is_active = TRUE
        ORDER BY cont.due_date ASC
        LIMIT ${limitInt}
      `;

      // FIX: Remove [limit] from the parameters array
      const contributions = await executeQuery(query);
      
      return contributions.map(contrib => ({
        ...contrib,
        outstanding_amount: parseFloat(contrib.outstanding_amount)
      }));
    } catch (error) {
      console.error('Error getting overdue contributions:', error);
      throw error;
    }
  }

  // Update contribution amount (for system-wide changes)
  async updateContributionAmount(newAmount, effectiveFromMonth) {
    try {
      const effectiveDate = moment(effectiveFromMonth).startOf('month').format('YYYY-MM-DD');
      
      // Update system setting
      await executeQuery(
        'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
        [newAmount.toString(), 'monthly_contribution_amount']
      );

      // Update future contributions that haven't been paid yet
      const updateQuery = `
        UPDATE contributions 
        SET amount_required = ? 
        WHERE contribution_month >= ? 
        AND status = 'pending' 
        AND amount_paid = 0
      `;
      
      const result = await executeQuery(updateQuery, [newAmount, effectiveDate]);

      return {
        new_amount: newAmount,
        effective_from: effectiveDate,
        updated_contributions: result.affectedRows
      };
    } catch (error) {
      console.error('Error updating contribution amount:', error);
      throw error;
    }
  }

  // Get contribution dashboard summary
  async getContributionDashboard() {
    try {
      const currentMonth = moment().startOf('month').format('YYYY-MM-DD');
      const currentYear = moment().year();

      const queries = [
        // This month's contribution stats
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          SUM(amount_required) as expected,
          SUM(amount_paid) as collected
         FROM contributions 
         WHERE contribution_month = ?`,

        // This year's contribution stats
        `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          SUM(amount_required) as expected,
          SUM(amount_paid) as collected
         FROM contributions 
         WHERE YEAR(contribution_month) = ?`,

        // Overdue contributions count
        `SELECT COUNT(*) as count
         FROM contributions 
         WHERE due_date < CURDATE() AND status != 'completed'`
      ];

      const [monthlyStats, yearlyStats, overdueCount] = await Promise.all([
        executeQuery(queries[0], [currentMonth]),
        executeQuery(queries[1], [currentYear]),
        executeQuery(queries[2])
      ]);

      return {
        current_month: {
          total_contributions: monthlyStats[0].total,
          completed_contributions: monthlyStats[0].completed,
          expected_amount: parseFloat(monthlyStats[0].expected || 0),
          collected_amount: parseFloat(monthlyStats[0].collected || 0),
          collection_rate: monthlyStats[0].total > 0 ? 
            ((monthlyStats[0].completed / monthlyStats[0].total) * 100).toFixed(2) : 0
        },
        current_year: {
          total_contributions: yearlyStats[0].total,
          completed_contributions: yearlyStats[0].completed,
          expected_amount: parseFloat(yearlyStats[0].expected || 0),
          collected_amount: parseFloat(yearlyStats[0].collected || 0),
          collection_rate: yearlyStats[0].total > 0 ? 
            ((yearlyStats[0].completed / yearlyStats[0].total) * 100).toFixed(2) : 0
        },
        overdue_contributions: overdueCount[0].count
      };
    } catch (error) {
      console.error('Error getting contribution dashboard:', error);
      throw error;
    }
  }
}

module.exports = new Contribution();