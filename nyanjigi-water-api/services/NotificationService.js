const SMSService = require('./SMSService');
const { SystemSettings } = require('../models');
const { executeQuery } = require('../config/database');

/**
 * Notification Service - Orchestrates SMS and Email notifications
 */
class NotificationService {
  constructor() {
    this.settings = null;
  }

  async initialize() {
    try {
      this.settings = await SystemSettings.getNotificationSettings();
      return true;
    } catch (error) {
      console.error('NotificationService initialization failed:', error.message);
      return false;
    }
  }

async sendNotification(recipient, notificationType, variables = {}, options = {}) {
  try {
    await this.initialize();

    const results = {
      sms: null,
      email: null,
      success: false
    };

    if (this.settings.sms_enabled && recipient.phone) {
      try {
        results.sms = await SMSService.sendTemplatedSMS(
          recipient.phone,
          notificationType,
          variables
        );
      } catch (error) {
        console.error('SMS notification failed:', error);
        results.sms = { success: false, error: error.message };
      }
    }

    if (this.settings.email_enabled && recipient.email) {
      results.email = { success: false, error: 'Email service not implemented' };
    }

    
    await this.logNotification(
      recipient.id,           
      recipient.phone,        
      notificationType,       
      'sms',                  
      results.sms?.success ? 'sent' : 'failed', 
      results,                
      variables               
    );
    
    results.success = Boolean(results.sms?.success || results.email?.success);
    return results;
  } catch (error) {
    console.error('Notification sending failed:', error);
    return {
      sms: null,
      email: null,
      success: false,
      error: error.message
    };
  }
}

  async sendBulkNotifications(recipients, notificationType, variableGenerator, options = {}) {
    try {
      await this.initialize();

      const results = [];
      const batchSize = options.batchSize || 50;

      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        const batchResults = await Promise.allSettled(
          batch.map(async (recipient) => {
            const variables = (typeof variableGenerator === 'function')
              ? variableGenerator(recipient)
              : variableGenerator;
            return this.sendNotification(recipient, notificationType, variables, options);
          })
        );

        batchResults.forEach((result, index) => {
          const recipient = batch[index];
          if (result.status === 'fulfilled') {
            results.push({
              recipient,
              result: result.value,
              success: result.value.success
            });
          } else {
            results.push({
              recipient,
              result: { success: false, error: result.reason?.message || 'Unknown error' },
              success: false
            });
          }
        });

        if (i + batchSize < recipients.length) {
          await this.delay(options.batchDelayMs || 1000);
        }
      }

      const summary = {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      };

      return {
        success: true,
        results,
        summary
      };
    } catch (error) {
      console.error('Bulk notification failed:', error);
      return {
        success: false,
        error: error.message,
        results: []
      };
    }
  }

  async sendBillingCycleMessages(payloads = []) {
    if (!payloads || payloads.length === 0) {
      return {
        success: true,
        summary: { total: 0, successful: 0, failed: 0 }
      };
    }

    await this.initialize();
    const results = [];

    for (const payload of payloads) {
      try {
        if (!payload.phone) {
          results.push({
            customer_id: payload.customer_id,
            success: false,
            error: 'Missing customer phone number'
          });
          continue;
        }

        const message = this.composeBillingMessage(payload);
        const smsResult = await SMSService.sendSMS(payload.phone, message);

        await this.logNotification(
          payload.customer_id,  
          payload.phone,        
          'billing_cycle',      
          'sms',                
          smsResult.success ? 'sent' : 'failed', 
          smsResult,            
          payload               
             );

        results.push({
          customer_id: payload.customer_id,
          success: smsResult.success,
          response: smsResult
        });
      } catch (error) {
        console.error('Billing SMS failed:', error);
        results.push({
          customer_id: payload.customer_id,
          success: false,
          error: error.message
        });
      }
    }

    return {
      success: true,
      summary: {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      },
      results
    };
  }

  composeBillingMessage(payload) {
    const flatRate = this.toCurrency(payload.current_month_charge);
    const outstandingBills = this.toCurrency(payload.previous_outstanding);
    const contributionOutstanding = this.toCurrency(
      payload.contribution_outstanding ?? payload.monthly_contribution_amount
    );
    const contributionTarget = this.toCurrency(payload.contribution_target || 18500);
    const fines = this.toCurrency(payload.outstanding_fines);
    const grace = payload.payment_grace_days || 5;

    return `Dear ${payload.customer_name}, your ${payload.billing_month_label} bill is ${flatRate}. `
      + `Your total outstanding bill is ${outstandingBills}. `
      + `You are also required to make a contribution for the water connection of ${contributionOutstanding} `
      + `(remaining towards the ${contributionTarget} target). `
      + `Your outstanding fines for overdue bills are ${fines}. `
      + `You are required to make a payment for this bill within ${grace} days through either of `
      + `Equity agent, Equity bank, Mpesa paybill- 247247 with the account number provided, `
      + `Equitel line or through USSD method. Thank you.`;
  }

  toCurrency(amount) {
    const value = Number(amount || 0);
    return `KES ${value.toFixed(2)}`;
  }

async logNotification(recipientId, recipientPhone, notificationType, channel, status, payload = null, metadata = null) {
  try {
    const query = `
        INSERT INTO notifications_sent
          (recipient_id, recipient_phone, recipient, notification_type, channel, status, payload, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
    
    // Get recipient name or use fallback
    const recipient = recipientPhone || `Customer ${recipientId}`;
    
    await executeQuery(query, [
      recipientId || null,
      recipientPhone || null,
      recipient,
      notificationType || null,
      channel || null,
      status || null,
      payload ? JSON.stringify(payload) : null,
      metadata ? JSON.stringify(metadata) : null
    ]);
  } catch (error) {
    console.error('Notification log failed:', error.message);
  }
}
  delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Process scheduled notifications
  async processScheduledNotifications() {
    try {
      // Check if scheduled_notifications table exists
      const tableCheckQuery = `
        SHOW TABLES LIKE 'scheduled_notifications'
      `;
      const tables = await executeQuery(tableCheckQuery);

      if (tables.length === 0) {
        // Table doesn't exist yet, return empty result
        return {
          processed: 0,
          successful: 0,
          failed: 0
        };
      }

      // Get pending scheduled notifications
      const pendingQuery = `
        SELECT * FROM scheduled_notifications
        WHERE status = 'pending'
        AND scheduled_time <= NOW()
        ORDER BY scheduled_time ASC
        LIMIT 50
      `;
      const pendingNotifications = await executeQuery(pendingQuery);

      if (pendingNotifications.length === 0) {
        return {
          processed: 0,
          successful: 0,
          failed: 0
        };
      }

      let successful = 0;
      let failed = 0;

      for (const notification of pendingNotifications) {
        try {
          // Send the notification
          const recipient = {
            id: notification.recipient_id,
            phone: notification.recipient_phone,
            email: notification.recipient_email
          };

          const variables = notification.variables ? JSON.parse(notification.variables) : {};
          const result = await this.sendNotification(recipient, notification.notification_type, variables);

          // Update notification status
          const updateQuery = `
            UPDATE scheduled_notifications
            SET status = ?, processed_at = NOW(), result = ?
            WHERE id = ?
          `;
          await executeQuery(updateQuery, [
            result.success ? 'sent' : 'failed',
            JSON.stringify(result),
            notification.id
          ]);

          if (result.success) {
            successful++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`Failed to process scheduled notification ${notification.id}:`, error);

          // Mark as failed
          const updateQuery = `
            UPDATE scheduled_notifications
            SET status = 'failed', processed_at = NOW(), result = ?
            WHERE id = ?
          `;
          await executeQuery(updateQuery, [
            JSON.stringify({ success: false, error: error.message }),
            notification.id
          ]);

          failed++;
        }
      }

      return {
        processed: pendingNotifications.length,
        successful,
        failed
      };
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        error: error.message
      };
    }
  }
}

module.exports = new NotificationService();
