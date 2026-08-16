const BaseModel = require('./BaseModel');
const { executeQuery, executeTransaction } = require('../config/database');
const moment = require('moment');

/**
 * Bill Model
 */
class Bill extends BaseModel {
  constructor() {
    super('bills');
  }

  // Generate bill number
  generateBillNumber(customerId, date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const customerPadded = String(customerId).padStart(4, '0');
    const timestamp = Date.now().toString().slice(-4);
    
    return `BILL-${year}${month}-${customerPadded}-${timestamp}`;
  }

  // Generate monthly bills for all active customers
  async generateMonthlyBills(billingMonth, customerIds = null) {
    try {
      const billingDate = moment(billingMonth).startOf('month');
      const previousMonth = billingDate.clone().subtract(1, 'month');

      // Get billing settings
      const settingsQuery = `
        SELECT setting_key, setting_value 
        FROM system_settings 
        WHERE setting_key IN ('payment_due_days', 'monthly_contribution_amount', 'total_contribution_target', 'water_rate_per_unit', 'default_flat_rate')
      `;
      const settings = await executeQuery(settingsQuery);
      const settingsMap = {};
      settings.forEach(s => settingsMap[s.setting_key] = s.setting_value);

      const paymentDueDays = parseInt(settingsMap.payment_due_days, 10) || 5;
      const monthlyContributionAmount = parseFloat(settingsMap.monthly_contribution_amount) || 0;
      const totalContributionTarget = parseFloat(settingsMap.total_contribution_target) || 20500.00;
      const ratePerUnit = parseFloat(settingsMap.water_rate_per_unit) || 50.00;
      
      //Move periodStart and periodEnd definitions UP HERE
      const periodStart = previousMonth.clone().startOf('month').format('YYYY-MM-DD');
      const periodEnd = previousMonth.clone().endOf('month').format('YYYY-MM-DD');
      
      // Get customers to bill with their connection date and type
      let customerQuery = `
              SELECT c.id, c.account_number, c.full_name, c.phone, c.customer_type,
                    mr.previous_reading, mr.current_reading, mr.id as reading_id,
                    COALESCE((SELECT SUM(total_amount) FROM bills WHERE customer_id = c.id AND status != 'paid'), 0) as previous_balance,
                    COALESCE((SELECT SUM(amount) FROM applied_fines WHERE customer_id = c.id AND status != 'paid'), 0) as outstanding_fines,
                    COALESCE((SELECT SUM(amount_paid) FROM contributions WHERE customer_id = c.id), 0) as total_contributions_paid
              FROM customers c
              LEFT JOIN meter_readings mr ON c.id = mr.customer_id AND mr.reading_month = ? AND mr.is_billed = FALSE
              WHERE c.is_active = TRUE
            `;
      
      // Now periodStart is safely initialized before it is used
      const params = [periodStart]; 

      if (customerIds && customerIds.length > 0) {
        customerQuery += ` AND c.id IN (${customerIds.map(() => '?').join(',')})`;
        params.push(...customerIds);
      }

      // Check for existing bills for this period and customer
      customerQuery += `
        AND NOT EXISTS (
          SELECT 1 FROM bills
          WHERE customer_id = c.id
          AND billing_period_start = ?
          AND billing_period_end = ?
        )
      `;
      params.push(periodStart, periodEnd);

      const customers = await executeQuery(customerQuery, params);

      if (customers.length === 0) {
        return {
          generated_count: 0,
          message: 'No customers found or bills already generated for this period',
          notifications: []
        };
      }

      const dueDate = billingDate.clone().add(paymentDueDays, 'days').format('YYYY-MM-DD');
      const notifications = [];

      // Prepare bill data for bulk insert with flat rate based on customer type
  const billsData = customers.map(customer => {
    let currentCharges = 0;
    let validUnits = 0;

    //Meters will be deployed later, and readings exist, calculate by units.
  if (customer.current_reading !== null && customer.previous_reading !== null && customer.customer_type !== 'flat_rate') {
      const unitsConsumed = customer.current_reading - customer.previous_reading;
      validUnits = unitsConsumed > 0 ? unitsConsumed : 0; 
      currentCharges = validUnits * ratePerUnit;
  } else {
      // Apply tiered flat rate pricing when meter readings are not available.
      if (customer.customer_type === 'institution') {
        currentCharges = 1000.00;
      } else if (customer.customer_type === 'normal') {
        currentCharges = 300.00;
      } else {
        currentCharges = parseFloat(settingsMap.default_flat_rate) || 0;
      }
  }

    const previousOutstanding = parseFloat(customer.previous_balance || 0);
    const outstandingFines = parseFloat(customer.outstanding_fines || 0);
    const contributionsPaid = parseFloat(customer.total_contributions_paid || 0);
    const contributionOutstanding = Math.max(0, totalContributionTarget - contributionsPaid);
    const totalAmount = currentCharges;

    notifications.push({
      customer_id: customer.id,
      customer_name: customer.full_name,
      phone: customer.phone,
      account_number: customer.account_number,
      billing_month_label: previousMonth.format('MMMM YYYY'),
      previous_outstanding: previousOutstanding,
      outstanding_fines: outstandingFines,
      monthly_contribution_amount: monthlyContributionAmount,
      contribution_outstanding: contributionOutstanding,
      contribution_target: totalContributionTarget,
      payment_grace_days: paymentDueDays,
      current_month_charge: currentCharges, 
      units_consumed: validUnits
    });

    return {
      customer_id: customer.id,
      bill_number: this.generateBillNumber(customer.id, billingDate.toDate()),
      billing_period_start: periodStart,
      billing_period_end: periodEnd,
      previous_balance: 0,
      current_charges: currentCharges,
      fines_applied: 0,
      total_amount: totalAmount,
      due_date: dueDate,
      status: 'pending',
      bill_type: 'flat_rate',
      meter_reading_previous: 0,
      meter_reading_current: 0,
      units_consumed: validUnits,
      rate_per_unit: ratePerUnit
    };
  });

    // Bulk insert bills ONLY ONCE
      if (billsData.length > 0) {
        await this.bulkInsert(billsData);
        
        // update meter readings if they actually exist
        // The filter removes 'null' values caused by the LEFT JOIN for unmetered customers
        const readingIds = customers
            .map(c => c.reading_id)
            .filter(id => id !== null && id !== undefined); 

        if (readingIds.length > 0) {
          await executeQuery(`UPDATE meter_readings SET is_billed = TRUE WHERE id IN (${readingIds.join(',')})`);
        }
      }

      console.log('Bills generated. Now processing automatic payments from advances');
      
      // Get unique list of customers who were just billed
      const billedCustomerIds = billsData.map(b => b.customer_id);
      
      // Require Payment here to avoid circular dependency issues at the top of the file
      const Payment = require('./Payment');

      // Process advances for each customer (can be done in parallel or sequence)
      // Using sequence to be safe with DB connections
      let autoPaidCount = 0;
      for (const custId of billedCustomerIds) {
        try {
          const result = await Payment.processCustomerAdvances(custId);
          if (result.allocations_made > 0) autoPaidCount++;
        } catch (err) {
          console.error(`Failed to process advance for customer ${custId}`, err);
        }
      }

      // Return result (enhanced with auto-pay info)
      return {
        generated_count: billsData.length,
        auto_paid_count: autoPaidCount, // New field in response
        billing_period: `${periodStart} to ${periodEnd}`,
        customers_billed: customers.map(c => ({
          id: c.id,
          account_number: c.account_number,
          name: c.full_name,
          due_date: dueDate
        })),
        notifications
      };

    } catch (error) {
      console.error('Error generating monthly bills:', error);
      throw error;
    }
  }

  // Get bills with pagination and filters
  async getBillsWithPagination(page = 1, limit = 50, filters = {}) {
    try {
      const offset = (page - 1) * limit;
      const conditions = [];
      const params = [];

      // Build WHERE conditions
      if (filters.customer_id) {
        conditions.push('b.customer_id = ?');
        params.push(filters.customer_id);
      }

      if (filters.status) {
        conditions.push('b.status = ?');
        params.push(filters.status);
      }

      if (filters.billing_month) {
        const month = moment(filters.billing_month);
        conditions.push('YEAR(b.billing_period_start) = ? AND MONTH(b.billing_period_start) = ?');
        params.push(month.year(), month.month() + 1);
      }

      if (filters.overdue) {
        conditions.push("b.due_date < CURDATE() AND b.status != 'paid'");
      }

      if (filters.search) {
        conditions.push(`(
          b.bill_number LIKE ? OR 
          c.full_name LIKE ? OR 
          c.account_number LIKE ?
        )`);
        params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get bills with customer info
      const billsQuery = `
        SELECT
          b.*,
          c.account_number,
          c.full_name as customer_name,
          c.phone as customer_phone,
          CASE
            WHEN b.due_date < CURDATE() AND b.status != 'paid' THEN 'overdue'
            ELSE b.status
          END as display_status
        FROM bills b
        INNER JOIN customers c ON b.customer_id = c.id
        ${whereClause}
        ORDER BY b.generated_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;

      const finalParams = [...params];
      console.log('Executing bills query with params:', finalParams);
      const bills = await executeQuery(billsQuery, finalParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM bills b
        INNER JOIN customers c ON b.customer_id = c.id
        ${whereClause}
      `;
      const countResult = await executeQuery(countQuery, params);
      const total = countResult[0].total;

      return {
        bills,
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
      console.error('Error getting bills with pagination:', error);
      throw error;
    }
  }

  // Get customer bills
  async getCustomerBills(customerId, page = 1, limit = 50) {
    try {
      const offset = (page - 1) * limit;

      const billsQuery = `SELECT * FROM bills WHERE customer_id = ${parseInt(customerId)} ORDER BY billing_period_start DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

      console.log('Executing customer bills query:', billsQuery);
      const bills = await executeQuery(billsQuery);

      // Add display_status to each bill
      const billsWithStatus = bills.map(bill => ({
        ...bill,
        display_status: (new Date(bill.due_date) < new Date() && bill.status !== 'paid') ? 'overdue' : bill.status
      }));

      // Get total count
      const countQuery = 'SELECT COUNT(*) as total FROM bills WHERE customer_id = ?';
      const countResult = await executeQuery(countQuery, [parseInt(customerId)]);
      const total = countResult[0].total;

      return {
        bills: billsWithStatus,
        pagination: {
          current_page: page,
          per_page: limit,
          total,
          total_pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting customer bills:', error);
      throw error;
    }
  }

  // Get single bill with customer info
  async getBillWithCustomer(billId) {
    try {
      const query = `
        SELECT 
          b.*,
          c.account_number,
          c.full_name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          c.location as customer_location,
          CASE 
            WHEN b.due_date < CURDATE() AND b.status != 'paid' THEN 'overdue'
            ELSE b.status 
          END as display_status
        FROM bills b
        INNER JOIN customers c ON b.customer_id = c.id
        WHERE b.id = ?
      `;

      const result = await executeQuery(query, [billId]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error getting bill with customer:', error);
      throw error;
    }
  }

  // Update bill statuses automatically (pending -> overdue)
  async updateBillStatuses() {
    try {
      const query = `
        UPDATE bills 
        SET status = 'overdue' 
        WHERE status = 'pending' 
        AND due_date < CURDATE()
      `;
      
      const result = await executeQuery(query);
      return result.affectedRows;
    } catch (error) {
      console.error('Error updating bill statuses:', error);
      throw error;
    }
  }

  // Add this method to your Bill class in Bill.js

  async getOutstandingAmount(billId) {
    try {
      const bill = await this.findById(billId);
      if (!bill) return 0;

      const paymentResult = await executeQuery(
        `SELECT COALESCE(SUM(amount), 0) AS total_paid
         FROM payment_allocations
         WHERE bill_id = ? AND allocation_type = 'bill_payment'`,
        [billId]
      );

      const totalAmount = parseFloat(bill.total_amount) || 0;
      const totalPaid = parseFloat(paymentResult[0]?.total_paid || 0);
      return Math.max(0, totalAmount - totalPaid);
    } catch (error) {
      console.error('Error calculating bill outstanding amount:', error);
      throw error;
    }
  }

  async reconcileBillStatus(billId) {
    try {
      const bill = await this.findById(billId);
      if (!bill) return null;

      const outstanding = await this.getOutstandingAmount(billId);
      const totalAmount = parseFloat(bill.total_amount) || 0;
      const paidAmount = Math.max(0, totalAmount - outstanding);

      let status = 'pending';
      if (paidAmount <= 0) {
        status = bill.due_date < new Date().toISOString().slice(0, 10) ? 'overdue' : 'pending';
      } else if (outstanding <= 0) {
        status = 'paid';
      } else {
        status = 'partially_paid';
      }

      const paidAt = status === 'paid' ? new Date() : null;
      await executeQuery(
        `UPDATE bills
         SET status = ?, paid_at = ?, updated_at = NOW()
         WHERE id = ?`,
        [status, paidAt, billId]
      );

      return await this.findById(billId);
    } catch (error) {
      console.error('Error reconciling bill status:', error);
      throw error;
    }
  }

  async updateBillStatus(billId, status, paidAt = null) {
    try {
      const query = `
        UPDATE bills 
        SET status = ?, paid_at = ?, updated_at = NOW()
        WHERE id = ?
      `;
      
      await executeQuery(query, [status, paidAt, billId]);
      return await this.findById(billId);
    } catch (error) {
      console.error('Error updating bill status:', error);
      throw error;
    }
  }

  // Get overdue bills
async getOverdueBills(limit = 100) {
  try {
    const limitInt = parseInt(limit); // Parse to integer
    
    const query = `
      SELECT 
        b.*,
        c.account_number,
        c.full_name as customer_name,
        c.phone as customer_phone,
        DATEDIFF(CURDATE(), b.due_date) as days_overdue
      FROM bills b
      INNER JOIN customers c ON b.customer_id = c.id
      WHERE b.due_date < CURDATE() 
      AND b.status != 'paid'
      AND c.is_active = TRUE
      ORDER BY b.due_date ASC
      LIMIT ${limitInt}
    `;

    const bills = await executeQuery(query); // Remove limit from params
    
    return bills.map(bill => ({
      ...bill,
      days_overdue: parseInt(bill.days_overdue)
    }));
  } catch (error) {
    console.error('Error getting overdue bills:', error);
    throw error;
  }
}
  // Calculate bill summary for a customer
  async getCustomerBillSummary(customerId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_bills,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_bills,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_bills,
          COUNT(CASE WHEN status = 'overdue' OR (due_date < CURDATE() AND status != 'paid') THEN 1 END) as overdue_bills,
          COALESCE(SUM(CASE WHEN status != 'paid' THEN total_amount ELSE 0 END), 0) as outstanding_amount,
          COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0) as total_paid
        FROM bills 
        WHERE customer_id = ?
      `;

      const result = await executeQuery(query, [customerId]);
      const summary = result[0];

      return {
        total_bills: summary.total_bills,
        paid_bills: summary.paid_bills,
        pending_bills: summary.pending_bills,
        overdue_bills: summary.overdue_bills,
        outstanding_amount: parseFloat(summary.outstanding_amount),
        total_paid: parseFloat(summary.total_paid)
      };
    } catch (error) {
      console.error('Error getting customer bill summary:', error);
      throw error;
    }
  }

  // Get billing statistics
  async getBillingStats(period = 'monthly') {
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
        default: // monthly
          dateFormat = '%Y-%m';
          dateRange = 'DATE_SUB(CURDATE(), INTERVAL 12 MONTH)';
      }

      const query = `
        SELECT 
          DATE_FORMAT(generated_at, '${dateFormat}') as period,
          COUNT(*) as bills_generated,
          COUNT(CASE WHEN status = 'paid' THEN 1 END) as bills_paid,
          SUM(total_amount) as total_billed,
          SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as total_collected
        FROM bills 
        WHERE generated_at >= ${dateRange}
        GROUP BY DATE_FORMAT(generated_at, '${dateFormat}')
        ORDER BY period ASC
      `;

      const stats = await executeQuery(query);
      
      return stats.map(row => ({
        period: row.period,
        bills_generated: row.bills_generated,
        bills_paid: row.bills_paid,
        total_billed: parseFloat(row.total_billed),
        total_collected: parseFloat(row.total_collected),
        collection_rate: row.bills_generated > 0 ? 
          ((row.bills_paid / row.bills_generated) * 100).toFixed(2) : 0
      }));
    } catch (error) {
      console.error('Error getting billing stats:', error);
      throw error;
    }
  }

  // Process bill payment
  async processBillPayment(billId, paymentAmount, paymentId) {
    try {
      const bill = await this.findById(billId);
      if (!bill) {
        throw new Error('Bill not found');
      }

      // Account for amounts already allocated to this bill from previous payments
      const existingResult = await executeQuery(
        `SELECT COALESCE(SUM(amount), 0) as already_paid
         FROM payment_allocations
         WHERE bill_id = ? AND allocation_type = 'bill_payment'`,
        [billId]
      );
      const alreadyPaid = parseFloat(existingResult[0].already_paid);
      const totalPaidAfterThis = alreadyPaid + paymentAmount;
      const remainingAmount = parseFloat(bill.total_amount) - totalPaidAfterThis;
      let newStatus = totalPaidAfterThis >= parseFloat(bill.total_amount) ? 'paid' : 'partially_paid';

      // Update bill status
      await this.updateBillStatus(billId, newStatus, newStatus === 'paid' ? new Date() : null);

      // Create payment allocation record
      const allocationQuery = `
        INSERT INTO payment_allocations (payment_id, bill_id, allocation_type, amount) 
        VALUES (?, ?, 'bill_payment', ?)
      `;
      await executeQuery(allocationQuery, [paymentId, billId, paymentAmount]);

      return {
        bill_id: billId,
        new_status: newStatus,
        amount_paid: paymentAmount,
        remaining_amount: Math.max(0, remainingAmount)
      };
    } catch (error) {
      console.error('Error processing bill payment:', error);
      throw error;
    }
  }

  // Execute raw SQL query (utility method)
  async rawQuery(query, params = []) {
    try {
      return await executeQuery(query, params);
    } catch (error) {
      console.error('Error executing raw query:', error);
      throw error;
    }
  }
}

module.exports = new Bill();