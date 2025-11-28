const BaseModel = require('./BaseModel');
const { executeQuery, getNextAccountNumber } = require('../config/database');
const AuthUtils = require('../utils/auth');

/**
 * Customer Model
 */
class Customer extends BaseModel {
  constructor() {
    super('customers');
  }

  // Create customer with auto-generated account number
  async createCustomer(customerData) {
    try {
      // Validate zone
      const validZones = ['Nyakahura', 'G3', 'Githunguri'];
      const zone = customerData.zone || 'Nyakahura';
      if (!validZones.includes(zone)) {
        throw new Error(`Invalid zone. Must be one of: ${validZones.join(', ')}`);
      }

      // Generate account number for the zone
      const accountNumber = await getNextAccountNumber(zone);

      // Generate default password if not provided
      let password = customerData.password;
      if (!password) {
        password = AuthUtils.generateRandomPassword();
      }

      const hashedPassword = await AuthUtils.hashPassword(password);

      const data = {
        account_number: accountNumber,
        full_name: customerData.full_name,
        phone: customerData.phone,
        email: customerData.email || null,
        location: customerData.location,
        zone: zone,
        connection_date: customerData.connection_date,
        meter_number: customerData.meter_number || null,
        password_hash: hashedPassword,
        is_active: true,
        customer_type: customerData.customer_type || 'normal'
      };

      const customer = await this.create(data);

      // Return customer with plain password for initial setup and SMS
      return {
        ...customer,
        plain_password: password // Only returned on creation
      };
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  // Find customer by account number
  async findByAccountNumber(accountNumber) {
    try {
      return await this.findOne({ account_number: accountNumber });
    } catch (error) {
      console.error('Error finding customer by account number:', error);
      throw error;
    }
  }

  // Find customer by phone
  async findByPhone(phone) {
    try {
      return await this.findOne({ phone: phone });
    } catch (error) {
      console.error('Error finding customer by phone:', error);
      throw error;
    }
  }

  // Update customer (excludes sensitive fields, but allows soft delete)
  async updateCustomer(id, updateData) {
    try {
      // Remove sensitive fields that shouldn't be updated directly
      const allowedFields = [
        'full_name', 'phone', 'email', 'location', 
        'meter_number', 'is_active', 'deleted'
      ];
      
      const filteredData = {};
      Object.keys(updateData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredData[key] = updateData[key];
        }
      });

      return await this.update(id, filteredData);
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  }

  // Change customer password
  async changePassword(customerId, newPassword) {
    try {
      const hashedPassword = await AuthUtils.hashPassword(newPassword);
      return await this.update(customerId, { password_hash: hashedPassword });
    } catch (error) {
      console.error('Error changing customer password:', error);
      throw error;
    }
  }

  // Get customers with pagination and search
  async getCustomersWithPagination(page = 1, limit = 10, search = '', status = '') {
    try {
      // Ensure page and limit are valid numbers
      const currentPage = Math.max(1, parseInt(page) || 1);
      const itemsPerPage = Math.min(100, Math.max(1, parseInt(limit) || 10));
      const offset = (currentPage - 1) * itemsPerPage;

      let whereClause = '';
      const params = [];

      // Build search conditions
      const conditions = [];

      if (search) {
        conditions.push(`(
          full_name LIKE ? OR
          account_number LIKE ? OR
          phone LIKE ? OR
          email LIKE ?
        )`);
        params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (status) {
        if (status === 'active') {
          conditions.push('is_active = TRUE');
        } else if (status === 'inactive') {
          conditions.push('is_active = FALSE');
        }
      }

      if (conditions.length > 0) {
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      // Get customers
      const customersQuery = `
        SELECT
          id, account_number, full_name, phone, email, location, zone,
          meter_number, connection_date, is_active, created_at, customer_type
        FROM customers
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${itemsPerPage} OFFSET ${offset}
      `;

      // Ensure limit and offset are passed as numbers
      const finalParams = [...params];
      console.log('Executing query with params:', finalParams);
      const customers = await executeQuery(customersQuery, finalParams);

      // Get total count
      const countQuery = `SELECT COUNT(*) as total FROM customers ${whereClause}`;
      const countResult = await executeQuery(countQuery, params);
      const total = countResult[0].total;

      return {
        customers,
        pagination: {
          current_page: currentPage,
          per_page: itemsPerPage,
          total,
          total_pages: Math.ceil(total / itemsPerPage),
          has_next: currentPage < Math.ceil(total / itemsPerPage),
          has_prev: currentPage > 1
        }
      };
    } catch (error) {
      console.error('Error getting customers with pagination:', error);
      throw error;
    }
  }

  // Get customer with current balance
  async getCustomerWithBalance(customerId) {
    try {
      const query = `
        SELECT 
          c.*,
          COALESCE(
            (SELECT SUM(total_amount) FROM bills WHERE customer_id = c.id AND status != 'paid'),
            0
          ) as outstanding_bills,
          COALESCE(
            (SELECT SUM(amount) FROM applied_fines WHERE customer_id = c.id AND status != 'paid'),
            0
          ) as outstanding_fines,
          COALESCE(
            (SELECT SUM(amount_required - amount_paid) FROM contributions WHERE customer_id = c.id AND status != 'completed'),
            0
          ) as outstanding_contributions
        FROM customers c
        WHERE c.id = ?
      `;

      const result = await executeQuery(query, [customerId]);
      if (result.length === 0) return null;

      const customer = result[0];
      customer.total_balance = 
        parseFloat(customer.outstanding_bills) + 
        parseFloat(customer.outstanding_fines) + 
        parseFloat(customer.outstanding_contributions);

      return customer;
    } catch (error) {
      console.error('Error getting customer with balance:', error);
      throw error;
    }
  }

  // Get customer dashboard data
  async getCustomerDashboard(customerId) {
    try {
      // Get customer with balance
      const customer = await this.getCustomerWithBalance(customerId);
      if (!customer) throw new Error('Customer not found');

      // Get recent bills
      const recentBillsQuery = `
        SELECT id, bill_number, billing_period_start, billing_period_end, 
               total_amount, status, due_date
        FROM bills 
        WHERE customer_id = ? 
        ORDER BY created_at DESC 
        LIMIT 5
      `;
      const recentBills = await executeQuery(recentBillsQuery, [customerId]);

      // Get recent payments
      const recentPaymentsQuery = `
        SELECT id, amount, payment_date, payment_method, status, transaction_id as reference_number
        FROM payments 
        WHERE customer_id = ? 
        ORDER BY payment_date DESC 
        LIMIT 5
      `;
      const recentPayments = await executeQuery(recentPaymentsQuery, [customerId]);

      // Get pending contributions
      const contributionsQuery = `
        SELECT id, contribution_month, amount_required, amount_paid, status, due_date
        FROM contributions 
        WHERE customer_id = ? AND status != 'completed'
        ORDER BY contribution_month DESC
      `;
      const contributions = await executeQuery(contributionsQuery, [customerId]);

      return {
        customer: {
          id: customer.id,
          account_number: customer.account_number,
          full_name: customer.full_name,
          phone: customer.phone,
          email: customer.email,
          connection_date: customer.connection_date,
          status: customer.is_active ? 'active' : 'inactive',
          current_balance: customer.total_balance,
          outstanding_bills: customer.outstanding_bills,
          outstanding_fines: customer.outstanding_fines,
          outstanding_contributions: customer.outstanding_contributions
        },
        recent_bills: recentBills,
        recent_payments: recentPayments,
        pending_contributions: contributions,
        usage_stats: {
          this_month: 0,
          last_month: 0,
          average_monthly: 0
        }
      };
    } catch (error) {
      console.error('Error getting customer dashboard:', error);
      throw error;
    }
  }

  // Authenticate customer login
  async authenticateCustomer(accountNumber, password) {
    try {
      const customer = await this.findByAccountNumber(accountNumber);
      
      if (!customer) {
        throw new Error('Invalid account number or password');
      }

      if (!customer.is_active) {
        throw new Error('Account is deactivated');
      }

      if (!customer.password_hash) {
        throw new Error('Password not set. Contact admin for password reset.');
      }

      const isValidPassword = await AuthUtils.comparePassword(password, customer.password_hash);
      
      if (!isValidPassword) {
        throw new Error('Invalid account number or password');
      }

      // Remove password from returned object
      const { password_hash, ...customerData } = customer;
      return customerData;
    } catch (error) {
      console.error('Error authenticating customer:', error);
      throw error;
    }
  }

  // Get customers summary statistics
  async getCustomerStats() {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_customers,
          COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_customers,
          COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactive_customers,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as new_this_month
        FROM customers
      `;

      const result = await executeQuery(query);
      return result[0];
    } catch (error) {
      console.error('Error getting customer stats:', error);
      throw error;
    }
  }
}

module.exports = new Customer();