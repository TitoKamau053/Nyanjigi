const { Customer, Bill, Contribution } = require('../models');
const { NotificationService } = require('../services');
const ApiResponse = require('../utils/response');
const { validationResult } = require('express-validator');

/**
 * NotificationController - Handles manual notification sending
 */
class NotificationController {
  /**
   * Send notifications to selected customers
   * POST /notifications/send
   */
  static async sendNotifications(req, res) {
    try {
      console.log('\n========== SEND NOTIFICATIONS DEBUG ==========');
      console.log('Headers received:', {
        authorization: req.headers.authorization ? 'PRESENT' : 'MISSING',
        contentType: req.headers['content-type']
      });
      console.log('Admin attached:', req.admin ? `YES (${req.admin.username})` : 'NO');
      console.log('Body:', req.body);
      console.log('============================================\n');

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return ApiResponse.validationError(res, errors.array());
      }

      const { customer_ids, notification_type, message, send_to_all = false } = req.body;
      const admin_id = req.admin?.id;

      if (!admin_id) {
        console.error('No admin_id found in request');
        return ApiResponse.error(res, 'Unauthorized', 401);
      }

      if (!notification_type || !['bill', 'contribution'].includes(notification_type)) {
        return ApiResponse.error(res, 'Invalid notification_type', 400);
      }

      if (!message || message.trim().length === 0) {
        return ApiResponse.error(res, 'Message is required', 400);
      }

      if (!send_to_all && (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0)) {
        return ApiResponse.error(res, 'customer_ids required when not sending to all', 400);
      }

      // Get customers to notify
      let customers = [];
      if (send_to_all) {
        customers = await Customer.findAll({
          where: { is_active: 1 },
          attributes: ['id', 'full_name', 'phone', 'account_number', 'zone']
        });
      } else {
        customers = await Customer.findAll({
          where: { 
            id: customer_ids,
            is_active: 1
          },
          attributes: ['id', 'full_name', 'phone', 'account_number', 'zone']
        });
      }

      if (!customers || customers.length === 0) {
        return ApiResponse.error(res, 'No active customers found', 404);
      }

      // Send notifications
      const results = {
        total: customers.length,
        successful: 0,
        failed: 0,
        failed_details: [],
        notification_type,
        timestamp: new Date().toISOString()
      };

      const notificationService = new NotificationService();

      for (const customer of customers) {
        try {
          // Personalize message with customer variables
          let personalizedMessage = message
            .replace(/\{customer_name\}/g, customer.full_name || 'Valued Customer')
            .replace(/\{account_number\}/g, customer.account_number || 'N/A')
            .replace(/\{phone\}/g, customer.phone || 'N/A');

          // Truncate to SMS limit if necessary
          if (personalizedMessage.length > 160) {
            personalizedMessage = personalizedMessage.substring(0, 157) + '...';
          }

          // Send the notification
          const response = await notificationService.sendNotification(
            {
              id: customer.id,
              phone: customer.phone,
              full_name: customer.full_name,
              account_number: customer.account_number
            },
            'manual_sms',
            { message: personalizedMessage },
            { manual: true }
          );

          if (response?.sms?.success) {
            results.successful++;
          } else {
            results.failed++;
            results.failed_details.push({
              customer_id: customer.id,
              customer_name: customer.full_name,
              phone: customer.phone,
              error: response?.sms?.error || 'Unknown error'
            });
          }
        } catch (error) {
          results.failed++;
          results.failed_details.push({
            customer_id: customer.id,
            customer_name: customer.full_name,
            phone: customer.phone,
            error: error.message
          });
        }
      }

      // Log notification batch
      try {
        await logNotificationBatch({
          admin_id,
          notification_type,
          total_recipients: results.total,
          successful: results.successful,
          failed: results.failed,
          message_preview: message.substring(0, 200),
          send_to_all,
          customer_ids: send_to_all ? null : customer_ids.join(',')
        });
      } catch (logError) {
        console.error('Failed to log notification batch:', logError);
      }

      return ApiResponse.success(res, results, 'Notifications sent', 200);
    } catch (error) {
      console.error('Error in sendNotifications:', error);
      return ApiResponse.error(res, 'Failed to send notifications', 500, error.message);
    }
  }

  /**
   * Get notification history for admin
   * GET /notifications/history
   */
  static async getNotificationHistory(req, res) {
    try {
      const { page = 1, limit = 20, notification_type, start_date, end_date } = req.query;
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM notifications_sent WHERE 1=1';
      const params = [];

      if (notification_type) {
        query += ' AND notification_type = ?';
        params.push(notification_type);
      }

      if (start_date) {
        query += ' AND created_at >= ?';
        params.push(new Date(start_date).toISOString());
      }

      if (end_date) {
        query += ' AND created_at <= ?';
        params.push(new Date(end_date).toISOString());
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);

      const { executeQuery } = require('../config/database');
      const notifications = await executeQuery(query, params);

      // Get total count
      let countQuery = 'SELECT COUNT(*) as count FROM notifications_sent WHERE 1=1';
      const countParams = [];

      if (notification_type) {
        countQuery += ' AND notification_type = ?';
        countParams.push(notification_type);
      }

      if (start_date) {
        countQuery += ' AND created_at >= ?';
        countParams.push(new Date(start_date).toISOString());
      }

      if (end_date) {
        countQuery += ' AND created_at <= ?';
        countParams.push(new Date(end_date).toISOString());
      }

      const [countResult] = await executeQuery(countQuery, countParams);
      const total = countResult?.count || 0;

      const paginationData = {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: Math.ceil(total / limit)
      };

      return ApiResponse.success(res, {
        notifications: notifications || [],
        pagination: paginationData
      }, 'Notification history retrieved', 200);
    } catch (error) {
      console.error('Error in getNotificationHistory:', error);
      return ApiResponse.error(res, 'Failed to fetch notification history', 500, error.message);
    }
  }

  /**
   * Get customers for selection
   * GET /notifications/customers?page=1&limit=50&search=&zone=
   */
  static async getCustomersForNotification(req, res) {
    try {
      const { search = '', zone = '', page = 1, limit = 100, all = false } = req.query;
      
      console.log('\n========== NOTIFICATION CONTROLLER DEBUG ==========');
      console.log('Request URL:', req.url);
      console.log('Query params:', req.query);
      console.log('Search value:', search);
      console.log('Search type:', typeof search);
      console.log('Search length:', search.length);
      console.log('==================================================\n');

      // Get all customers (both active and inactive) for notifications
      let baseQuery = `SELECT id, full_name, account_number, phone, zone, is_active FROM customers`;
      let countQuery = `SELECT COUNT(*) as count FROM customers`;
      const params = [];
      const countParams = [];
      
      let whereAdded = false;

      if (search && search.trim().length > 0) {
        const searchTerm = `%${search}%`;
        const searchCondition = ' WHERE (full_name LIKE ? OR account_number LIKE ? OR phone LIKE ?)';
        baseQuery += searchCondition;
        countQuery += searchCondition;
        params.push(searchTerm, searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm, searchTerm);
        whereAdded = true;
        console.log('✓ SEARCH ENABLED');
        console.log('  Search term:', searchTerm);
        console.log('  Count Query:', countQuery);
        console.log('  Count Params:', countParams);
      } else {
        console.log('✗ NO SEARCH - Returning all customers');
      }

      if (zone) {
        const zoneCondition = whereAdded ? ' AND zone = ?' : ' WHERE zone = ?';
        baseQuery += zoneCondition;
        countQuery += zoneCondition;
        params.push(zone);
        countParams.push(zone);
        whereAdded = true;
        console.log('✓ ZONE FILTER:', zone);
      }

      // Get total count
      const { executeQuery } = require('../config/database');
      console.log('\nExecuting COUNT query...');
      const countResult = await executeQuery(countQuery, countParams);
      const [result] = countResult;
      const total = result?.count || 0;
      console.log('Total customers found:', total);
      
      if (search && search.trim().length > 0 && total === 0) {
        console.log('\n⚠️  SEARCH RETURNED 0 RESULTS!');
        console.log('Full count query:', countQuery);
        console.log('Count params:', countParams);
        
        // Debug: Check total without filter
        const allCountResult = await executeQuery('SELECT COUNT(*) as count FROM customers', []);
        console.log('Total customers in DB (no filter):', allCountResult[0]?.count);
        
        // Debug: Try direct search on just full_name
        const testQuery = 'SELECT id, full_name FROM customers WHERE full_name LIKE ? LIMIT 5';
        const testResults = await executeQuery(testQuery, [`%${search}%`]);
        console.log('Direct LIKE search on full_name:', testResults?.length || 0, 'results');
        if (testResults && testResults.length > 0) {
          testResults.forEach(r => console.log('  -', r));
        }
      }

      baseQuery += ' ORDER BY full_name';

      let customers = [];
      let pagination = null;

      // If 'all' parameter is true, get all customers without pagination
      if (all === 'true' || all === true) {
        console.log('\nFetching ALL customers (no pagination)');
        customers = await executeQuery(baseQuery, params);
        console.log('Customers returned:', customers?.length || 0);
        pagination = {
          page: 1,
          limit: total,
          total: total,
          total_pages: 1,
          has_more: false
        };
      } else {
        // Apply pagination
        const pageNum = Math.max(1, parseInt(page) || 1);
        const limitNum = Math.min(1000, Math.max(1, parseInt(limit) || 100));
        const offset = (pageNum - 1) * limitNum;

        baseQuery += ' LIMIT ? OFFSET ?';
        params.push(limitNum, offset);
        
        console.log('\nFetching page', pageNum, 'with limit', limitNum, 'offset', offset);
        console.log('Base query:', baseQuery);
        console.log('Params:', params);
        customers = await executeQuery(baseQuery, params);
        console.log('Customers returned:', customers?.length || 0);

        pagination = {
          page: pageNum,
          limit: limitNum,
          total: total,
          total_pages: Math.ceil(total / limitNum),
          has_more: (pageNum * limitNum) < total
        };
      }

      console.log('RESPONSE: ', customers?.length, 'customers, pagination:', pagination);
      console.log('==========================================\n');

      return ApiResponse.success(res, {
        customers: customers || [],
        pagination
      }, 'Customers retrieved', 200);
    } catch (error) {
      console.error('❌ ERROR in getCustomersForNotification:', error);
      return ApiResponse.error(res, 'Failed to fetch customers', 500, error.message);
    }
  }
}

/**
 * Helper function to log notification batch
 */
async function logNotificationBatch(data) {
  const { executeQuery } = require('../config/database');
  
  const query = `
    INSERT INTO notification_logs 
    (admin_id, notification_type, total_recipients, successful, failed, message_preview, send_to_all, customer_ids, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    data.admin_id,
    data.notification_type,
    data.total_recipients,
    data.successful,
    data.failed,
    data.message_preview,
    data.send_to_all ? 1 : 0,
    data.customer_ids,
    new Date().toISOString()
  ];

  await executeQuery(query, params);
}

module.exports = NotificationController;
