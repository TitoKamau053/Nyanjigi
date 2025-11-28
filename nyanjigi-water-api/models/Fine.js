const BaseModel = require('./BaseModel');
const { executeQuery } = require('../config/database');

/**
 * Fine Model - Handles fine types and applied fines
 */
class Fine extends BaseModel {
  constructor() {
    super('applied_fines');
  }


  // Get all fine types
  async getFineTypes() {
    const query = 'SELECT * FROM fine_types WHERE is_active = TRUE ORDER BY fine_name ASC';
    return await executeQuery(query);
  }

  // Get all applied fines for all customers (paginated)
  async getAllFines(page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT af.*, ft.fine_name, ft.fine_type, c.full_name, c.account_number
      FROM applied_fines af
      INNER JOIN fine_types ft ON af.fine_type_id = ft.id
      INNER JOIN customers c ON af.customer_id = c.id
      ORDER BY af.applied_date DESC
      LIMIT ${offset}, ${limit}
    `;
    return await executeQuery(query);
  }

  // Get applied fines for a customer
  async getAppliedFinesByCustomer(customerId, page = 1, limit = 10) {
    const offset = (page - 1) * limit;
    const query = `
      SELECT af.*, ft.fine_name, ft.fine_type
      FROM applied_fines af
      INNER JOIN fine_types ft ON af.fine_type_id = ft.id
      WHERE af.customer_id = ?
      ORDER BY af.applied_date DESC
      LIMIT ${offset}, ${limit}
    `;
    return await executeQuery(query, [customerId]);
  }

  // Apply a new fine to a customer
  async applyFine(customerId, fineTypeId, amount, reason, appliedDate) {
    const query = `
      INSERT INTO applied_fines (customer_id, fine_type_id, amount, reason, applied_date, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `;
    const result = await executeQuery(query, [customerId, fineTypeId, amount, reason, appliedDate]);
    return result.insertId;
  }

  // Update fine status (e.g., paid, waived)
  async updateFineStatus(fineId, status) {
    const query = 'UPDATE applied_fines SET status = ? WHERE id = ?';
    await executeQuery(query, [status, fineId]);
  }

  // Get fine by ID
  async getFineById(fineId) {
    const query = `
      SELECT af.*, ft.fine_name, ft.fine_type
      FROM applied_fines af
      INNER JOIN fine_types ft ON af.fine_type_id = ft.id
      WHERE af.id = ?
    `;
    const result = await executeQuery(query, [fineId]);
    return result.length > 0 ? result[0] : null;
  }
}

module.exports = new Fine();
