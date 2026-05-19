const { Customer, Bill, Contribution } = require('../models');
const { NotificationService } = require('../services');
const { ApiResponse } = require('../utils/response');
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
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json(ApiResponse.error('Validation failed', errors.array()));
      }

      const { customer_ids, notification_type, message, send_to_all = false } = req.body;
      const admin_id = req.user?.id;

      if (!admin_id) {
        return res.status(401).json(ApiResponse.error('Unauthorized'));
      }

      if (!notification_type || !['bill', 'contribution'].includes(notification_type)) {
        return res.status(400).json(ApiResponse.error('Invalid notification_type'));
      }

      if (!message || message.trim().length === 0) {
        return res.status(400).json(ApiResponse.error('Message is required'));
      }

      if (!send_to_all && (!customer_ids || !Array.isArray(customer_ids) || customer_ids.length === 0)) {
        return res.status(400).json(ApiResponse.error('customer_ids required when not sending to all'));
      }

      // Get customers to notify
      let customers = [];
      if (send_to_all) {
        // Get all active customers
        customers = await Customer.findAll({
          where: { status: 'active' },
          attributes: ['id', 'full_name', 'phone', 'account_number']
        });
      } else {
        // Get specific customers
        customers = await Customer.findAll({
          where: { 
            id: customer_ids,
            status: 'active' 
          },
          attributes: ['id', 'full_name', 'phone', 'account_number']
        });
      }

      if (!customers || customers.length === 0) {
        return res.status(404).json(ApiResponse.error('No active customers found'));
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
        // Don't fail the request, just log the error
      }

      return res.status(200).json(ApiResponse.success('Notifications sent', results));
    } catch (error) {
      console.error('Error in sendNotifications:', error);
      return res.status(500).json(ApiResponse.error('Failed to send notifications', error.message));
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

      let query = 'SELECT * FROM notification_logs WHERE 1=1';
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
      let countQuery = 'SELECT COUNT(*) as count FROM notification_logs WHERE 1=1';
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

      return res.status(200).json(ApiResponse.success('Notification history retrieved', {
        notifications: notifications || [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          total_pages: Math.ceil(total / limit)
        }
      }));
    } catch (error) {
      console.error('Error in getNotificationHistory:', error);
      return res.status(500).json(ApiResponse.error('Failed to fetch notification history', error.message));
    }
  }

  /**
   * Get customers for selection
   * GET /notifications/customers
   */
  static async getCustomersForNotification(req, res) {
    try {
      const { search = '', zone } = req.query;

      let query = 'SELECT id, full_name, account_number, phone, zone FROM customers WHERE status = ?';
      const params = ['active'];

      if (search) {
        query += ' AND (full_name LIKE ? OR account_number LIKE ? OR phone LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      if (zone) {
        query += ' AND zone = ?';
        params.push(zone);
      }

      query += ' ORDER BY full_name LIMIT 100';

      const { executeQuery } = require('../config/database');
      const customers = await executeQuery(query, params);

      return res.status(200).json(ApiResponse.success('Customers retrieved', {
        customers: customers || []
      }));
    } catch (error) {
      console.error('Error in getCustomersForNotification:', error);
      return res.status(500).json(ApiResponse.error('Failed to fetch customers', error.message));
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
