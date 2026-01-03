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
  /**
   * Process Overpayments for a customer
   */
async processCustomerAdvances(customerId) {
    try {
      const safeCustomerId = parseInt(customerId);
      console.log(`Processing overpayments for customer: ${customerId}`);

      // Fetch all overpayments for the customer
      const advancesQuery = `
      SELECT pa.id, pa.amount, pa.payment_id, p.transaction_id
        FROM payment_allocations pa
        JOIN payments p ON pa.payment_id = p.id
        WHERE p.customer_id = ? 
        AND pa.allocation_type = 'advance'
        AND pa.amount > 0
        ORDER BY pa.created_at ASC
      `;
      const advances = await executeQuery(advancesQuery, [customerId]);

      if (advances.length === 0) {
        return{ processed: false, message: 'No advances found for this customer.' };
      }

      let totalAdvance = advances.reduce((sum, adv) => sum + parseFloat(adv.amount), 0);
      console.log(`Total advance amount: ${totalAdvance}`);

      const Bill = require('./Bill');
      const Fine = require('./Fine');
      const Contribution = require('./Contribution');

      //get all unpaid bills, fines, contributions
      const bills = await executeQuery(
        `SELECT id, total_amount, status FROM bills 
         WHERE customer_id = ? AND status != 'paid' 
         ORDER BY due_date ASC`, 
        [safeCustomerId] 
      );

      const fines = await executeQuery(
        `SELECT id, amount, status FROM applied_fines 
          WHERE customer_id = ? AND status != 'paid' 
          ORDER BY applied_date ASC`,
        [safeCustomerId] 
      );

      const contributions = await executeQuery(
        `SELECT id, amount_required, amount_paid, status FROM contributions 
          WHERE customer_id = ? AND status != 'completed' 
          ORDER BY contribution_month ASC`,
        [safeCustomerId] 
      );

      let allocatedCount = 0;

      // 3. Helper function to use advance funds
      const useAdvance = async (amountNeeded, itemId, itemType, notes) => {
        let remainingNeeded = amountNeeded;

        // Loop through advances until need is met or advances run out
        for (const advance of advances) {
          if (remainingNeeded <= 0 || parseFloat(advance.amount) <= 0) continue;

          const amountToTake = Math.min(parseFloat(advance.amount), remainingNeeded);
          
          // Logic: "Split" the advance allocation
          // If taking full amount: convert type to 'bill_payment'/'fine'/etc
          // If taking partial: reduce advance amount, create new allocation for item

          if (amountToTake >= parseFloat(advance.amount)) {
            // OPTION A: Fully consume this advance record
            // Update the existing allocation record to point to the new item
            const updateQuery = `
              UPDATE payment_allocations 
              SET allocation_type = ?, bill_id = ?, amount = ?, notes = ?
              WHERE id = ?
            `;
            // Note: bill_id column is used for bills, for others it might be null/unused in schema
            // If schema strictly links bills, handle accordingly. Assuming 'bill_id' is nullable for fines/contribs
            const billIdVal = itemType === 'bill_payment' ? itemId : null;
            
            await executeQuery(updateQuery, [itemType, billIdVal, amountToTake, notes, advance.id]);
            
            // Mark as used in our local array
            advance.amount = 0;
          } else {
            // OPTION B: Partially consume
            // 1. Reduce existing advance
            const newAdvanceAmount = parseFloat(advance.amount) - amountToTake;
            await executeQuery(
              'UPDATE payment_allocations SET amount = ? WHERE id = ?', 
              [newAdvanceAmount, advance.id]
            );
            
            // 2. Create new allocation for the item linked to original payment
            const insertQuery = `
              INSERT INTO payment_allocations 
              (payment_id, bill_id, allocation_type, amount, notes)
              VALUES (?, ?, ?, ?, ?)
            `;
            const billIdVal = itemType === 'bill_payment' ? itemId : null;
            
            await executeQuery(insertQuery, [
              advance.payment_id, billIdVal, itemType, amountToTake, notes
            ]);

            // Update local tracking
            advance.amount = newAdvanceAmount;
          }

          remainingNeeded -= amountToTake;
          totalAdvance -= amountToTake;
        }
        return amountNeeded - remainingNeeded; // Amount actually allocated
      };

      // 4. Allocate to items in priority order
      
      // A. Pay Bills
      for (const bill of bills) {
        if (totalAdvance <= 0) break;
        
        // Calculate pending amount (assuming partial payments exist, check allocations)
        // Simplification: relying on Bill.updateBillStatus logic usually handled by controller
        // We need accurate outstanding balance.
        const allocations = await executeQuery(
          "SELECT SUM(amount) as paid FROM payment_allocations WHERE bill_id = ? AND allocation_type = 'bill_payment'",
          [bill.id]
        );
        const alreadyPaid = parseFloat(allocations[0].paid || 0);
        const outstanding = parseFloat(bill.total_amount) - alreadyPaid;

        if (outstanding > 0) {
          const allocated = await useAdvance(outstanding, bill.id, 'bill_payment', `Paid from Advance Balance`);
          if (allocated > 0) {
            const newStatus = (alreadyPaid + allocated) >= parseFloat(bill.total_amount) ? 'paid' : 'partially_paid';
            await Bill.updateBillStatus(bill.id, newStatus, newStatus === 'paid' ? new Date() : null);
            allocatedCount++;
          }
        }
      }

      // B. Pay Fines
      for (const fine of fines) {
        if (totalAdvance <= 0) break;
        
        // Check if fine table tracks partials? Schema says 'status' and 'amount'. 
        // Assuming allocations track partials or it's one-off.
        // We'll assume we check current allocations for this fine (if schema links fine_id in allocations, 
        // BUT schema provided only has bill_id in allocations table). 
        // **Workaround**: If schema doesn't link fines to allocations, we usually just update the fine status directly 
        // and create an allocation record with notes.
        
        const fineAllocated = await useAdvance(parseFloat(fine.amount), null, 'fine', `Fine #${fine.id} payment`);
        if (fineAllocated >= parseFloat(fine.amount)) {
            await executeQuery("UPDATE applied_fines SET status = 'paid' WHERE id = ?", [fine.id]);
            allocatedCount++;
        }
      }

      // C. Pay Contributions
      for (const contrib of contributions) {
        if (totalAdvance <= 0) break;

        const outstanding = parseFloat(contrib.amount_required) - parseFloat(contrib.amount_paid);
        if (outstanding > 0) {
          const allocated = await useAdvance(outstanding, null, 'contribution', `Contribution #${contrib.id} payment`);
          
          if (allocated > 0) {
            const newPaid = parseFloat(contrib.amount_paid) + allocated;
            const newStatus = newPaid >= parseFloat(contrib.amount_required) ? 'completed' : 'partial';
            
            await executeQuery(
              "UPDATE contributions SET amount_paid = ?, status = ?, completed_at = ? WHERE id = ?",
              [newPaid, newStatus, (newStatus === 'completed' ? new Date() : null), contrib.id]
            );
            allocatedCount++;
          }
        }
      }

      return {
        processed: true,
        allocations_made: allocatedCount,
        remaining_advance: totalAdvance
      };
    } catch (error) {
      console.error('Error processing overpayment:', error);
      throw error;
    }
  }
}

module.exports = new Payment();
