const BaseModel = require('./BaseModel');
const { executeQuery } = require('../config/database');
const moment = require('moment');

class Payment extends BaseModel {
  constructor() {
    super('payments');
  }

  /**
   * Get payments with filters (for admin view)
   */
async getPaymentsWithPagination(page = 1, limit = 20, filters = {}) {
  try {
    const pageInt = parseInt(page);
    const limitInt = parseInt(limit);
    const offset = (pageInt - 1) * limitInt;
    
    const conditions = [];
    const params = [];

    if (filters.customer_id) {
      conditions.push('p.customer_id = ?');
      params.push(parseInt(filters.customer_id));
    }

    if (filters.status) {
      conditions.push('p.status = ?');
      params.push(filters.status);
    }

    if (filters.date_from) {
      conditions.push('DATE(p.payment_date) >= ?');
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      conditions.push('DATE(p.payment_date) <= ?');
      params.push(filters.date_to);
    }

    if (filters.search) {
      conditions.push(`(
        p.transaction_id LIKE ? OR
        p.equity_reference LIKE ? OR
        c.full_name LIKE ? OR
        c.account_number LIKE ?
      )`);
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Build query with string interpolation for LIMIT/OFFSET (same as getCustomerPayments)
    const paymentsQuery = `
      SELECT
        p.*,
        c.account_number,
        c.full_name as customer_name,
        c.phone as customer_phone
      FROM payments p
      INNER JOIN customers c ON p.customer_id = c.id
      ${whereClause}
      ORDER BY p.payment_date DESC
      LIMIT ${limitInt} OFFSET ${offset}
    `;

    const payments = await executeQuery(paymentsQuery, params);

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM payments p
      INNER JOIN customers c ON p.customer_id = c.id
      ${whereClause}
    `;
    const countResult = await executeQuery(countQuery, params);
    const total = countResult[0].total;

    return {
      payments,
      pagination: {
        current_page: pageInt,
        per_page: limitInt,
        total,
        total_pages: Math.ceil(total / limitInt)
      }
    };
  } catch (error) {
    console.error('Error getting payments:', error);
    throw error;
  }
}
  /**
   * Get customer payments
   */
async getCustomerPayments(customerId, page = 1, limit = 10) {
  try {
    const offset = (page - 1) * limit;
    const safeLimit = parseInt(limit);
    const safeOffset = parseInt(offset);
    
    // STEP 1: Get payments - use string interpolation for LIMIT/OFFSET
    const paymentsQuery = `
      SELECT 
        p.*
      FROM payments p
      WHERE p.customer_id = ?
      ORDER BY p.payment_date DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    const payments = await executeQuery(paymentsQuery, [customerId]);

    // STEP 2: Get allocations for each payment
    const paymentsWithAllocations = await Promise.all(
      payments.map(async (payment) => {
        const allocationsQuery = `
          SELECT 
            pa.allocation_type as type,
            pa.amount,
            b.bill_number
          FROM payment_allocations pa
          LEFT JOIN bills b ON pa.bill_id = b.id
          WHERE pa.payment_id = ?
        `;
        
        const allocations = await executeQuery(allocationsQuery, [payment.id]);
        
        return {
          ...payment,
          allocations: allocations || []
        };
      })
    );

    // STEP 3: Get total count
    const countQuery = 'SELECT COUNT(*) as total FROM payments WHERE customer_id = ?';
    const countResult = await executeQuery(countQuery, [customerId]);
    const total = countResult[0].total;

    return {
      payments: paymentsWithAllocations,
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
    console.error('Error getting customer payments:', error);
    throw error;
  }
}
  /**
   * Get payment with allocations
   */
  async getPaymentWithAllocations(paymentId) {
    try {
      const paymentQuery = `
        SELECT 
          p.*,
          c.account_number,
          c.full_name as customer_name,
          c.phone as customer_phone
        FROM payments p
        INNER JOIN customers c ON p.customer_id = c.id
        WHERE p.id = ?
      `;

      const payment = await executeQuery(paymentQuery, [paymentId]);
      if (!payment || payment.length === 0) return null;

      const allocationsQuery = `
        SELECT 
          pa.*,
          b.bill_number,
          CASE 
            WHEN pa.allocation_type = 'bill_payment' THEN 'Bill Payment'
            WHEN pa.allocation_type = 'contribution' THEN 'Contribution'
            WHEN pa.allocation_type = 'fine' THEN 'Fine Payment'
            WHEN pa.allocation_type = 'advance' THEN 'Advance Payment'
            ELSE pa.allocation_type
          END as allocation_description
        FROM payment_allocations pa
        LEFT JOIN bills b ON pa.bill_id = b.id
        WHERE pa.payment_id = ?
        ORDER BY pa.created_at ASC
      `;

      const allocations = await executeQuery(allocationsQuery, [paymentId]);

      return {
        ...payment[0],
        allocations
      };
    } catch (error) {
      console.error('Error getting payment details:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(period = 'monthly') {
    try {
      let dateFormat, dateRange;
      
      switch (period) {
        case 'daily':
          dateFormat = '%Y-%m-%d';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
          break;
        case 'yearly':
          dateFormat = '%Y';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 5 YEAR)';
          break;
        default:
          dateFormat = '%Y-%m';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
      }

      const query = `
        SELECT 
          DATE_FORMAT(payment_date, '${dateFormat}') as period,
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as total_collected,
          AVG(CASE WHEN status = 'completed' THEN amount END) as average_amount,
          COUNT(CASE WHEN payment_method = 'equity_branch' THEN 1 END) as branch_payments,
          COUNT(CASE WHEN payment_method = 'equity_agent' THEN 1 END) as agent_payments,
          COUNT(CASE WHEN payment_method = 'equity_mpesa' THEN 1 END) as mpesa_payments,
          COUNT(CASE WHEN payment_method = 'equity_ussd' THEN 1 END) as ussd_payments,
          COUNT(CASE WHEN payment_method = 'equity_equitel' THEN 1 END) as equitel_payments,
          COUNT(CASE WHEN payment_method = 'equity_app' THEN 1 END) as app_payments
        FROM payments 
        WHERE payment_date >= ${dateRange}
        GROUP BY period
        ORDER BY period ASC
      `;

      const stats = await executeQuery(query);
      
      return stats.map(row => ({
        period: row.period,
        total_transactions: row.total_transactions,
        successful: row.successful,
        success_rate: row.total_transactions > 0 
          ? ((row.successful / row.total_transactions) * 100).toFixed(2) 
          : 0,
        total_collected: parseFloat(row.total_collected || 0),
        average_amount: parseFloat(row.average_amount || 0),
        payment_channels: {
          branch: row.branch_payments,
          agent: row.agent_payments,
          mpesa: row.mpesa_payments,
          ussd: row.ussd_payments,
          equitel: row.equitel_payments,
          app: row.app_payments
        }
      }));
    } catch (error) {
      console.error('Error getting payment stats:', error);
      throw error;
    }
  }
}

module.exports = new Payment();
