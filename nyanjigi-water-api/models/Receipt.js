const BaseModel = require('./BaseModel');
const { executeQuery } = require('../config/database');
const moment = require('moment');

/**
 * Receipt Model - Handles payment receipts for all transactions
 */
class Receipt extends BaseModel {
  constructor() {
    super('receipts');
  }

  /**
   * Generate receipt number in format RCP-YYYYMMDD-XXXX
   */
  async generateReceiptNumber() {
    try {
      const today = moment().format('YYYYMMDD');
      const countQuery = `
        SELECT COUNT(*) as count FROM receipts 
        WHERE DATE(issued_date) = DATE(NOW())
      `;
      const result = await executeQuery(countQuery);
      const count = result[0].count + 1;
      const receiptNumber = `RCP-${today}-${String(count).padStart(4, '0')}`;
      return receiptNumber;
    } catch (error) {
      console.error('Error generating receipt number:', error);
      throw error;
    }
  }

  /**
   * Create receipt for a payment
   */
  async createReceipt(data) {
    try {
      const {
        customer_id,
        payment_id,
        payment_type,
        amount,
        payment_method,
        payment_reference,
        description,
        issued_by
      } = data;

      const receipt_number = await this.generateReceiptNumber();

      const query = `
        INSERT INTO receipts (
          customer_id, payment_id, receipt_number, payment_type, 
          amount, payment_method, payment_reference, description, issued_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await executeQuery(query, [
        customer_id,
        payment_id,
        receipt_number,
        payment_type,
        amount,
        payment_method,
        payment_reference,
        description,
        issued_by
      ]);

      return {
        id: result.insertId,
        receipt_number,
        ...data
      };
    } catch (error) {
      console.error('Error creating receipt:', error);
      throw error;
    }
  }

  /**
   * Get receipt by ID with customer details
   */
  async getReceiptWithDetails(receiptId) {
    try {
      const query = `
        SELECT 
          r.*,
          c.account_number,
          c.full_name as customer_name,
          c.phone as customer_phone,
          c.email as customer_email,
          a.full_name as issued_by_name
        FROM receipts r
        INNER JOIN customers c ON r.customer_id = c.id
        LEFT JOIN admins a ON r.issued_by = a.id
        WHERE r.id = ?
      `;

      const results = await executeQuery(query, [receiptId]);
      return results[0] || null;
    } catch (error) {
      console.error('Error getting receipt with details:', error);
      throw error;
    }
  }

  /**
   * Get customer receipts with pagination
   */
  async getCustomerReceipts(customerId, page = 1, limit = 10) {
    try {
      const offset = (page - 1) * limit;
      const safeLimit = Math.min(parseInt(limit), 100);

      const query = `
        SELECT 
          r.*,
          c.account_number,
          c.full_name as customer_name,
          p.transaction_id
        FROM receipts r
        INNER JOIN customers c ON r.customer_id = c.id
        INNER JOIN payments p ON r.payment_id = p.id
        WHERE r.customer_id = ?
        ORDER BY r.issued_date DESC
        LIMIT ${safeLimit} OFFSET ${offset}
      `;

      const receipts = await executeQuery(query, [customerId]);

      const countQuery = `SELECT COUNT(*) as total FROM receipts WHERE customer_id = ?`;
      const countResult = await executeQuery(countQuery, [customerId]);
      const total = countResult[0].total;

      return {
        receipts,
        pagination: {
          current_page: page,
          per_page: safeLimit,
          total,
          total_pages: Math.ceil(total / safeLimit)
        }
      };
    } catch (error) {
      console.error('Error getting customer receipts:', error);
      throw error;
    }
  }

  /**
   * Get all receipts (admin view) with filters
   */
  async getReceiptsWithPagination(page = 1, limit = 20, filters = {}) {
    try {
      const pageInt = parseInt(page);
      const limitInt = Math.min(parseInt(limit), 100);
      const offset = (pageInt - 1) * limitInt;

      const conditions = [];
      const params = [];

      if (filters.customer_id) {
        conditions.push('r.customer_id = ?');
        params.push(parseInt(filters.customer_id));
      }

      if (filters.payment_type) {
        conditions.push('r.payment_type = ?');
        params.push(filters.payment_type);
      }

      if (filters.date_from) {
        conditions.push('DATE(r.issued_date) >= ?');
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        conditions.push('DATE(r.issued_date) <= ?');
        params.push(filters.date_to);
      }

      if (filters.search) {
        conditions.push(`(
          r.receipt_number LIKE ? OR
          c.account_number LIKE ? OR
          c.full_name LIKE ? OR
          c.phone LIKE ?
        )`);
        const searchTerm = `%${filters.search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          r.*,
          c.account_number,
          c.full_name as customer_name,
          c.phone as customer_phone,
          p.transaction_id
        FROM receipts r
        INNER JOIN customers c ON r.customer_id = c.id
        INNER JOIN payments p ON r.payment_id = p.id
        ${whereClause}
        ORDER BY r.issued_date DESC
        LIMIT ${limitInt} OFFSET ${offset}
      `;

      const receipts = await executeQuery(query, params);

      const countQuery = `
        SELECT COUNT(*) as total FROM receipts r
        INNER JOIN customers c ON r.customer_id = c.id
        INNER JOIN payments p ON r.payment_id = p.id
        ${whereClause}
      `;
      const countResult = await executeQuery(countQuery, params);
      const total = countResult[0].total;

      return {
        receipts,
        pagination: {
          current_page: pageInt,
          per_page: limitInt,
          total,
          total_pages: Math.ceil(total / limitInt)
        }
      };
    } catch (error) {
      console.error('Error getting receipts with pagination:', error);
      throw error;
    }
  }

  /**
   * Get receipts by payment type for reporting
   */
  async getReceiptsByType(paymentType, filters = {}) {
    try {
      const conditions = ['r.payment_type = ?'];
      const params = [paymentType];

      if (filters.date_from) {
        conditions.push('DATE(r.issued_date) >= ?');
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        conditions.push('DATE(r.issued_date) <= ?');
        params.push(filters.date_to);
      }

      const whereClause = conditions.join(' AND ');

      const query = `
        SELECT 
          r.*,
          c.account_number,
          c.full_name as customer_name,
          SUM(r.amount) as total_amount
        FROM receipts r
        INNER JOIN customers c ON r.customer_id = c.id
        WHERE ${whereClause}
        GROUP BY DATE(r.issued_date), r.payment_type
        ORDER BY r.issued_date DESC
      `;

      return await executeQuery(query, params);
    } catch (error) {
      console.error('Error getting receipts by type:', error);
      throw error;
    }
  }

  /**
   * Get receipt summary statistics
   */
  async getReceiptSummary(filters = {}) {
    try {
      const conditions = [];
      const params = [];

      if (filters.date_from) {
        conditions.push('DATE(r.issued_date) >= ?');
        params.push(filters.date_from);
      }

      if (filters.date_to) {
        conditions.push('DATE(r.issued_date) <= ?');
        params.push(filters.date_to);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const query = `
        SELECT 
          r.payment_type,
          COUNT(*) as count,
          SUM(r.amount) as total_amount,
          AVG(r.amount) as average_amount
        FROM receipts r
        ${whereClause}
        GROUP BY r.payment_type
      `;

      const results = await executeQuery(query, params);
      
      // Format results into a summary object
      const summary = {
        total_receipts: 0,
        total_amount: 0,
        by_type: {}
      };

      results.forEach(row => {
        summary.total_receipts += row.count;
        summary.total_amount += parseFloat(row.total_amount);
        summary.by_type[row.payment_type] = {
          count: row.count,
          total: parseFloat(row.total_amount),
          average: parseFloat(row.average_amount)
        };
      });

      return summary;
    } catch (error) {
      console.error('Error getting receipt summary:', error);
      throw error;
    }
  }

  /**
   * Search receipts
   */
  async searchReceipts(searchTerm, limit = 20) {
    try {
      const query = `
        SELECT 
          r.*,
          c.account_number,
          c.full_name as customer_name,
          c.phone as customer_phone,
          p.transaction_id
        FROM receipts r
        INNER JOIN customers c ON r.customer_id = c.id
        INNER JOIN payments p ON r.payment_id = p.id
        WHERE 
          r.receipt_number LIKE ? OR
          c.account_number LIKE ? OR
          c.full_name LIKE ? OR
          p.transaction_id LIKE ?
        ORDER BY r.issued_date DESC
        LIMIT ?
      `;

      const searchPattern = `%${searchTerm}%`;
      return await executeQuery(query, [
        searchPattern,
        searchPattern,
        searchPattern,
        searchPattern,
        limit
      ]);
    } catch (error) {
      console.error('Error searching receipts:', error);
      throw error;
    }
  }
}

module.exports = Receipt;
