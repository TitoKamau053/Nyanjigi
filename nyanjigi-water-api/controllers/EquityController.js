/**
 * ===========================================
 * EQUITY BANK EXTERNAL PAYMENT SYSTEM
 * ===========================================
 * 
 * Complete implementation for Equity Bank external payment integration
 * All payments are processed through Equity channels:
 * - Branch deposits
 * - Agent deposits
 * - M-Pesa Paybill (247247)
 * - Equitel USSD
 * - Equity Mobile App
 * - USSD (*247#)
 */

// ============================================
// 1. EQUITY CONTROLLER (controllers/EquityController.js)
// ============================================

const { Customer, Bill, Contribution, Fine, Payment } = require('../models');
const { executeQuery, executeTransaction } = require('../config/database');
const ApiResponse = require('../utils/response');
const moment = require('moment');

class EquityController {
  /**
   * STEP 1: Customer Validation
   * Called by Equity API when customer initiates payment
   * Equity needs to verify customer exists and get outstanding balance
   */
  async validateCustomer(req, res) {
    try {
      const { member_number, phone } = req.body;

      // Log validation request for audit
      console.log('[Equity Validation]', {
        member_number,
        phone: phone || 'not provided',
        timestamp: new Date().toISOString()
      });

      // Validate input
      if (!member_number) {
        return res.status(400).json({
          success: false,
          message: 'Member number (account number) is required'
        });
      }

      // Find customer by account number
      const customerQuery = `
        SELECT 
          id, 
          account_number, 
          full_name, 
          phone, 
          is_active,
          customer_type
        FROM customers 
        WHERE account_number = ? 
        LIMIT 1
      `;
      
      const customers = await executeQuery(customerQuery, [member_number]);

      if (!customers || customers.length === 0) {
        console.log('[Equity Validation] Customer not found:', member_number);
        return res.status(404).json({
          success: false,
          message: 'Customer account not found'
        });
      }

      const customer = customers[0];

      // Check if customer is active
      if (!customer.is_active) {
        console.log('[Equity Validation] Inactive account:', member_number);
        return res.status(403).json({
          success: false,
          message: 'Customer account is inactive. Please contact support.'
        });
      }

      // Optional: Verify phone number if provided
      if (phone && customer.phone !== phone) {
        console.warn('[Equity Validation] Phone mismatch:', {
          provided: phone,
          registered: customer.phone
        });
        // Don't fail, just log warning
      }

      // Calculate total outstanding balance
      const balanceQuery = `
        SELECT 
          COALESCE(SUM(outstanding), 0) as total_outstanding 
        FROM (
          -- Outstanding bills
          SELECT SUM(total_amount) as outstanding
          FROM bills
          WHERE customer_id = ? 
          AND status IN ('pending', 'overdue', 'partially_paid')
          
          UNION ALL
          
          -- Outstanding fines
          SELECT SUM(amount) as outstanding
          FROM applied_fines
          WHERE customer_id = ? 
          AND status = 'pending'
          
          UNION ALL
          
          -- Outstanding contributions
          SELECT SUM(amount_required - amount_paid) as outstanding
          FROM contributions
          WHERE customer_id = ? 
          AND status IN ('pending', 'partial', 'overdue')
        ) as totals
      `;

      const balanceResult = await executeQuery(balanceQuery, [
        customer.id, 
        customer.id, 
        customer.id
      ]);
      
      const outstandingBalance = parseFloat(balanceResult[0]?.total_outstanding || 0);

      // Get breakdown for customer info
      const breakdownQuery = `
        SELECT 
          COALESCE(SUM(CASE WHEN status IN ('pending', 'overdue', 'partially_paid') THEN total_amount ELSE 0 END), 0) as bills,
          COALESCE((SELECT SUM(amount) FROM applied_fines WHERE customer_id = ? AND status = 'pending'), 0) as fines,
          COALESCE((SELECT SUM(amount_required - amount_paid) FROM contributions WHERE customer_id = ? AND status IN ('pending', 'partial', 'overdue')), 0) as contributions
        FROM bills
        WHERE customer_id = ?
      `;
      
      const breakdownResult = await executeQuery(breakdownQuery, [
        customer.id, 
        customer.id, 
        customer.id
      ]);
      
      const breakdown = breakdownResult[0];

      // Success response to Equity
      const response = {
        success: true,
        data: {
          member_id: customer.id,
          member_number: customer.account_number,
          name: customer.full_name,
          phone: customer.phone,
          customer_type: customer.customer_type,
          status: 'active',
          outstanding_balance: parseFloat(outstandingBalance.toFixed(2)),
          balance_breakdown: {
            bills: parseFloat(breakdown.bills || 0),
            fines: parseFloat(breakdown.fines || 0),
            contributions: parseFloat(breakdown.contributions || 0)
          }
        }
      };

      console.log('[Equity Validation] Success:', {
        member_number,
        outstanding: outstandingBalance
      });

      return res.status(200).json(response);

    } catch (error) {
      console.error('[Equity Validation] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'System error during validation',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * STEP 2: Payment Callback Handler
   * Called by Equity API after customer completes payment
   * Equity sends payment confirmation with transaction details
   */
  async handlePaymentCallback(req, res) {
    try {
      const {
        transaction_id,
        member_number,
        customer_name,
        amount,
        reference_type,
        payment_method,
        status,
        timestamp,
        narrative
      } = req.body;

      // Log callback received
      console.log('[Equity Callback] Received:', {
        transaction_id,
        member_number,
        amount,
        status,
        timestamp: new Date().toISOString()
      });

      // Validate required fields
      const requiredFields = {
        transaction_id: 'Transaction ID',
        member_number: 'Member/Account number',
        amount: 'Payment amount',
        payment_method: 'Payment method',
      };

      for (const [field, label] of Object.entries(requiredFields)) {
        if (!req.body[field]) {
          console.error(`[Equity Callback] Missing field: ${field}`);
          return res.status(400).json({
            success: false,
            message: `Missing required field: ${label}`
          });
        }
      }

      // Acknowledge receipt immediately to Equity (prevents timeout)
      res.status(202).json({
        success: true,
        message: 'Payment callback received and queued for processing',
        transaction_id: transaction_id,
        received_at: new Date().toISOString()
      });

      // Process payment asynchronously (don't block Equity's callback)
      this.processEquityPayment({
        transaction_id,
        member_number,
        customer_name,
        amount,
        reference_type: reference_type || 'general',
        payment_method,
        status,
        timestamp: timestamp || new Date().toISOString(),
        narrative
      }).catch(error => {
        console.error('[Equity Callback] Processing error:', error);
      });

    } catch (error) {
      console.error('[Equity Callback] Handler error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * STEP 3: Process Payment (Async)
   * Allocates payment to bills, fines, and contributions
   */
async processEquityPayment(callbackData) {
    try {
      const {
        transaction_id,
        member_number,
        customer_name,
        amount,
        reference_type,
        payment_method,
        status,
        timestamp
      } = callbackData;

      console.log('[Equity Process] Starting:', transaction_id);

      let finalStatus = 'completed';
      
      if (status && status.trim() !== '') {
        const providedStatus = status.toLowerCase();
         if (providedStatus === 'failed' || providedStatus === 'reversed') {
             finalStatus = 'failed';
         }
      }

      // Check failure status
      if (finalStatus === 'failed') {
        console.log('[Equity Process] Payment failed:', { transaction_id, status: finalStatus });
        await this.logPaymentAttempt({
          transaction_id,
          member_number,
          amount,
          payment_method,
          status: 'failed',
          reason: `Payment status explicitly set to: ${status}`,
          timestamp
        });
        return;
      }

      // Find customer
      const customerQuery = `
        SELECT id, account_number, full_name, phone 
        FROM customers 
        WHERE account_number = ? 
        LIMIT 1
      `;
      const customers = await executeQuery(customerQuery, [member_number]);

      if (!customers || customers.length === 0) {
        console.error('[Equity Process] Customer not found:', member_number);
        await this.logPaymentAttempt({
          transaction_id,
          member_number,
          amount,
          payment_method,
          status: 'error',
          reason: 'Customer not found',
          timestamp
        });
        return;
      }

      const customer = customers[0];

      // Check for duplicate payment (idempotency)
      const duplicateCheck = `
        SELECT id FROM payments 
        WHERE transaction_id = ? 
        OR equity_reference = ?
        LIMIT 1
      `;
      const existing = await executeQuery(duplicateCheck, [
        `EQ-${transaction_id}`,
        transaction_id
      ]);

      if (existing && existing.length > 0) {
        console.warn('[Equity Process] Duplicate payment:', transaction_id);
        return;
      }

      // Create payment record
      const paymentInsertQuery = `
        INSERT INTO payments (
          customer_id,
          transaction_id,
          equity_reference,
          equity_member_number,
          payment_method,
          amount,
          payment_date,
          status,
          equity_callback_response,
          notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const paymentDate = moment(timestamp).isValid() 
        ? moment(timestamp).toDate() 
        : new Date();

      const insertResult = await executeQuery(paymentInsertQuery, [
        customer.id,
        `EQ-${transaction_id}`,
        transaction_id,
        member_number,
        `equity_${payment_method}`,
        parseFloat(amount),
        paymentDate,
        finalStatus,
        JSON.stringify(callbackData),
        callbackData.narrative || `Equity payment via ${payment_method}`
      ]);

      const paymentId = insertResult.insertId;

      console.log('[Equity Process] Payment recorded:', {
        payment_id: paymentId,
        customer_id: customer.id,
        amount: amount
      });

      // Allocate payment to outstanding items
      const allocationResult = await this.allocatePayment(
        paymentId,
        customer.id,
        parseFloat(amount),
        reference_type
      );

      console.log('[Equity Process] Allocation complete:', {
        payment_id: paymentId,
        allocated: allocationResult.total_allocated,
        advance: allocationResult.advance_payment
      });
      
      const variables = {
        customer_name: customer.full_name,
        amount: amount,
        transaction_id: transaction_id,
        payment_date: new Date().toLocaleString(),
        account_number: customer.account_number
      };

      const recipient = {
        id: customer.id,
        phone: customer.phone,
        email: customer.email || null
      };
      // Send payment confirmation SMS
      const NotificationService = require('../services/NotificationService');
      await NotificationService.sendNotification(
        {
          id: customer.id,
          phone: customer.phone,
          email: customer.email
        },
        'payment_received',
        variables
      );

      await this.logPaymentAttempt({
        transaction_id,
        member_number,
        amount,
        payment_method,
        status: 'processed',
        payment_id: paymentId,
        timestamp
      });

    } catch (error) {
      console.error('[Equity Process] Error:', error);
      
      await this.logPaymentAttempt({
        transaction_id: callbackData.transaction_id,
        member_number: callbackData.member_number,
        amount: callbackData.amount,
        payment_method: callbackData.payment_method,
        status: 'error',
        reason: error.message,
        timestamp: callbackData.timestamp
      }).catch(e => console.error('Error logging failed payment:', e));
    }
  }

  /**
   * STEP 4: Payment Allocation Logic
   * Priority: Bills (by due date) → Fines → Contributions → Advance
   */
  async allocatePayment(paymentId, customerId, amount, referenceType = 'general') {
    try {
      let remainingAmount = amount;
      const allocations = [];

      console.log('[Allocation] Starting:', {
        payment_id: paymentId,
        customer_id: customerId,
        amount,
        reference_type: referenceType
      });

      // Priority-based allocation based on reference type
      if (referenceType === 'bill') {
        const billAlloc = await this.allocateToBills(paymentId, customerId, remainingAmount);
        remainingAmount -= billAlloc.allocated;
        allocations.push(...billAlloc.allocations);
      } else if (referenceType === 'fine') {
        const fineAlloc = await this.allocateToFines(paymentId, customerId, remainingAmount);
        remainingAmount -= fineAlloc.allocated;
        allocations.push(...fineAlloc.allocations);
      } else if (referenceType === 'contribution') {
        const contribAlloc = await this.allocateToContributions(paymentId, customerId, remainingAmount);
        remainingAmount -= contribAlloc.allocated;
        allocations.push(...contribAlloc.allocations);
      }

      // Default allocation order: Bills → Fines → Contributions
      if (remainingAmount > 0) {
        const billAlloc = await this.allocateToBills(paymentId, customerId, remainingAmount);
        remainingAmount -= billAlloc.allocated;
        allocations.push(...billAlloc.allocations);
      }

      if (remainingAmount > 0) {
        const fineAlloc = await this.allocateToFines(paymentId, customerId, remainingAmount);
        remainingAmount -= fineAlloc.allocated;
        allocations.push(...fineAlloc.allocations);
      }

      if (remainingAmount > 0) {
        const contribAlloc = await this.allocateToContributions(paymentId, customerId, remainingAmount);
        remainingAmount -= contribAlloc.allocated;
        allocations.push(...contribAlloc.allocations);
      }

      // Record advance payment if money remains
      if (remainingAmount > 0.01) { // Use 0.01 to handle floating point precision
        const advanceQuery = `
          INSERT INTO payment_allocations 
          (payment_id, allocation_type, amount, notes)
          VALUES (?, 'advance', ?, 'Advance payment - available for future bills')
        `;
        await executeQuery(advanceQuery, [paymentId, remainingAmount]);
        
        allocations.push({
          type: 'advance',
          amount: remainingAmount
        });
        
        console.log('[Allocation] Advance payment:', remainingAmount);
      }

      return {
        success: true,
        total_allocated: amount - remainingAmount,
        advance_payment: remainingAmount,
        allocations: allocations
      };

    } catch (error) {
      console.error('[Allocation] Error:', error);
      throw error;
    }
  }

  /**
   * Allocate to Bills (oldest due date first)
   */
  async allocateToBills(paymentId, customerId, availableAmount) {
    try {
      if (availableAmount <= 0) {
        return { allocated: 0, allocations: [] };
      }

      const billsQuery = `
        SELECT id, bill_number, total_amount, due_date, status
        FROM bills
        WHERE customer_id = ? 
        AND status IN ('pending', 'overdue', 'partially_paid')
        ORDER BY due_date ASC, id ASC
        LIMIT 20
      `;

      const bills = await executeQuery(billsQuery, [customerId]);
      let allocated = 0;
      const allocations = [];

      for (const bill of bills) {
        if (availableAmount <= 0) break;

        const billOutstanding = parseFloat(bill.total_amount);
        const allocationAmount = Math.min(availableAmount, billOutstanding);

        // Insert allocation record
        const allocationQuery = `
          INSERT INTO payment_allocations 
          (payment_id, bill_id, allocation_type, amount)
          VALUES (?, ?, 'bill_payment', ?)
        `;
        await executeQuery(allocationQuery, [paymentId, bill.id, allocationAmount]);

        // Update bill status
        const newStatus = allocationAmount >= billOutstanding ? 'paid' : 'partially_paid';
        const paidAt = newStatus === 'paid' ? new Date() : null;
        
        const Bill = require('../models/Bill');
        await Bill.updateBillStatus(bill.id, newStatus, paidAt);

        availableAmount -= allocationAmount;
        allocated += allocationAmount;

        allocations.push({
          type: 'bill',
          bill_id: bill.id,
          bill_number: bill.bill_number,
          amount: allocationAmount,
          new_status: newStatus
        });

        console.log(`[Allocation] Bill ${bill.bill_number}: KES ${allocationAmount} (${newStatus})`);
      }

      return { allocated, allocations };
    } catch (error) {
      console.error('[Allocation] Bills error:', error);
      throw error;
    }
  }

  /**
   * Allocate to Fines (oldest first)
   */
  async allocateToFines(paymentId, customerId, availableAmount) {
    try {
      if (availableAmount <= 0) {
        return { allocated: 0, allocations: [] };
      }

      const finesQuery = `
        SELECT id, amount, applied_date, reason
        FROM applied_fines
        WHERE customer_id = ? 
        AND status = 'pending'
        ORDER BY applied_date ASC
        LIMIT 10
      `;

      const fines = await executeQuery(finesQuery, [customerId]);
      let allocated = 0;
      const allocations = [];

      for (const fine of fines) {
        if (availableAmount <= 0) break;

        const fineAmount = parseFloat(fine.amount);
        const allocationAmount = Math.min(availableAmount, fineAmount);

        // Insert allocation
        const allocationQuery = `
          INSERT INTO payment_allocations 
          (payment_id, allocation_type, amount, notes)
          VALUES (?, 'fine', ?, ?)
        `;
        await executeQuery(allocationQuery, [
          paymentId, 
          allocationAmount,
          `Fine payment: ${fine.reason}`
        ]);

        // Update fine status if fully paid
        if (allocationAmount >= fineAmount) {
          const fineUpdateQuery = `
            UPDATE applied_fines 
            SET status = 'paid' 
            WHERE id = ?
          `;
          await executeQuery(fineUpdateQuery, [fine.id]);
        }

        availableAmount -= allocationAmount;
        allocated += allocationAmount;

        allocations.push({
          type: 'fine',
          fine_id: fine.id,
          amount: allocationAmount
        });

        console.log(`[Allocation] Fine ${fine.id}: KES ${allocationAmount}`);
      }

      return { allocated, allocations };
    } catch (error) {
      console.error('[Allocation] Fines error:', error);
      throw error;
    }
  }

  /**
   * Allocate to Contributions (oldest month first)
   */
  async allocateToContributions(paymentId, customerId, availableAmount) {
    try {
      if (availableAmount <= 0) {
        return { allocated: 0, allocations: [] };
      }

      const contributionsQuery = `
        SELECT id, contribution_month, amount_required, amount_paid
        FROM contributions
        WHERE customer_id = ? 
        AND status IN ('pending', 'partial', 'overdue')
        ORDER BY contribution_month ASC
        LIMIT 10
      `;

      const contributions = await executeQuery(contributionsQuery, [customerId]);
      let allocated = 0;
      const allocations = [];

      for (const contribution of contributions) {
        if (availableAmount <= 0) break;

        const outstanding = parseFloat(contribution.amount_required) - 
                          parseFloat(contribution.amount_paid);
        const allocationAmount = Math.min(availableAmount, outstanding);

        // Insert allocation
        const allocationQuery = `
          INSERT INTO payment_allocations 
          (payment_id, allocation_type, amount, notes)
          VALUES (?, 'contribution', ?, ?)
        `;
        await executeQuery(allocationQuery, [
          paymentId,
          allocationAmount,
          `Contribution for ${moment(contribution.contribution_month).format('MMMM YYYY')}`
        ]);

        // Update contribution
        const newPaid = parseFloat(contribution.amount_paid) + allocationAmount;
        const newStatus = newPaid >= parseFloat(contribution.amount_required) 
          ? 'completed' 
          : 'partial';
        
        const contributionUpdateQuery = `
          UPDATE contributions 
          SET 
            amount_paid = ?,
            status = ?,
            completed_at = CASE WHEN ? = 'completed' THEN NOW() ELSE NULL END
          WHERE id = ?
        `;
        await executeQuery(contributionUpdateQuery, [
          newPaid,
          newStatus,
          newStatus,
          contribution.id
        ]);

        availableAmount -= allocationAmount;
        allocated += allocationAmount;

        allocations.push({
          type: 'contribution',
          contribution_id: contribution.id,
          amount: allocationAmount,
          new_status: newStatus
        });

        console.log(`[Allocation] Contribution ${contribution.id}: KES ${allocationAmount}`);
      }

      return { allocated, allocations };
    } catch (error) {
      console.error('[Allocation] Contributions error:', error);
      throw error;
    }
  }

  /**
   * Log payment attempt for audit trail
   */
  async logPaymentAttempt(data) {
    try {
      const query = `
          INSERT INTO payment_logs 
          (transaction_id, member_number, amount, payment_method, status, reason, payment_id, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
      
      // Convert ISO string to MySQL datetime format
      const timestamp = data.timestamp 
        ? new Date(data.timestamp).toISOString().slice(0, 19).replace('T', ' ')
        : new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      await executeQuery(query, [
        data.transaction_id,
        data.member_number,
        data.amount,
        data.payment_method,
        data.status,
        data.reason || null,
        data.payment_id || null,
        timestamp
      ]);
    } catch (error) {
      console.error('[Payment Log]', data);
    }
  }

  /**
   * Get payment history for customer
   */
  async getPaymentHistory(req, res) {
    try {
      const { customer_id } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      // Verify customer access
      if (req.customer && req.customer.id !== parseInt(customer_id)) {
        return ApiResponse.forbidden(res, 'Access denied');
      }

      const historyQuery = `
        SELECT
          p.id,
          p.transaction_id,
          p.equity_reference,
          p.amount,
          p.payment_date,
          p.payment_method,
          p.status,
          p.notes,
          (
            SELECT JSON_ARRAYAGG(
              JSON_OBJECT(
                'type', pa.allocation_type,
                'amount', pa.amount,
                'bill_number', b.bill_number
              )
            )
            FROM payment_allocations pa
            LEFT JOIN bills b ON pa.bill_id = b.id
            WHERE pa.payment_id = p.id
          ) as allocations
        FROM payments p
        WHERE p.customer_id = ? 
        AND p.payment_method LIKE 'equity_%'
        ORDER BY p.payment_date DESC
        LIMIT ? OFFSET ?
      `;

      const payments = await executeQuery(historyQuery, [customer_id, limit, offset]);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM payments 
        WHERE customer_id = ? 
        AND payment_method LIKE 'equity_%'
      `;
      const countResult = await executeQuery(countQuery, [customer_id]);
      const total = countResult[0].total;

      return ApiResponse.success(res, {
        payments: payments.map(p => ({
          ...p,
          allocations: p.allocations ? JSON.parse(p.allocations) : []
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      console.error('[Payment History] Error:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = new EquityController();