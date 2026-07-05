const SMSService = require('./SMSService');
const { SystemSettings } = require('../models');
const { executeQuery } = require('../config/database');

/**
 * Notification Service - Handles SMS notifications
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

      // 1. Send SMS
      if (this.settings.sms_enabled && recipient.phone) {
        try {
          if (notificationType === 'manual_sms' || notificationType === 'custom') {
             // Handle manual/custom messages directly
             const messageContent = variables.message || 'Test Notification';
             results.sms = await SMSService.sendSMS(recipient.phone, messageContent);
          } else {
             // Normal templated messages
             results.sms = await SMSService.sendTemplatedSMS(
              recipient.phone,
              notificationType,
              variables
            );
          }
        } catch (error) {
          console.error('SMS notification failed:', error);
          results.sms = { success: false, error: error.message };
        }
      }

      // 2. Send Email (Placeholder)
      if (this.settings.email_enabled && recipient.email) {
        results.email = { success: false, error: 'Email service not implemented' };
      }

      // 3. Log the Notification
      // Extract the actual message sent for logging purposes
      let messageContent = variables.message || '';
      if (!messageContent && notificationType !== 'manual_sms') {
          // For templates, we might store a description or the template name as fallback
          messageContent = `Template: ${notificationType}`;
      }

      await this.logNotification(
        recipient.id,           
        recipient.phone,        
        notificationType,       
        'sms',                  
        results.sms?.success ? 'sent' : 'failed', 
        results,                
        variables,
        messageContent // Pass message content to logger
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

  // ... (sendBulkNotifications and sendBillingCycleMessages remain unchanged) ...
  async sendBulkNotifications(recipients, notificationType, variableGenerator, options = {}) {
    // Keep your existing code for this method
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
    // Keep your existing code for this method
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
            payload,
            message // Pass the composed message
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

  // ... (composeBillingMessage, toCurrency, delay, processScheduledNotifications remain unchanged) ...
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

  delay(ms = 1000) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Send contribution reminders in bulk (used by scheduler)
  async sendContributionReminders(contributions = []) {
    if (!Array.isArray(contributions) || contributions.length === 0) {
      return { success: true, summary: { total: 0, successful: 0, failed: 0 }, results: [] };
    }

    const recipients = contributions.map((item) => ({
      id: item.customer_id,
      phone: item.customer_phone || item.phone,
      full_name: item.customer_name || item.full_name || 'Customer',
      account_number: item.account_number,
      amount_required: item.amount_required || item.amount,
      due_date: item.due_date
    }));

    return this.sendBulkNotifications(
      recipients,
      'contribution_reminder',
      (recipient) => ({
        customer_name: recipient.full_name,
        account_number: recipient.account_number || '',
        amount: this.toCurrency(recipient.amount_required || 0),
        due_date: recipient.due_date ? new Date(recipient.due_date).toLocaleDateString() : ''
      })
    );
  }

  // Send overdue bill notices in bulk (used by scheduler)
  async sendOverdueNotices(overdueBills = []) {
    if (!Array.isArray(overdueBills) || overdueBills.length === 0) {
      return { success: true, summary: { total: 0, successful: 0, failed: 0 }, results: [] };
    }

    const recipients = overdueBills.map((bill) => ({
      id: bill.customer_id,
      phone: bill.customer_phone || bill.phone,
      full_name: bill.customer_name || bill.full_name || 'Customer',
      account_number: bill.account_number,
      bill_number: bill.bill_number,
      total_amount: bill.total_amount,
      due_date: bill.due_date
    }));

    return this.sendBulkNotifications(
      recipients,
      'overdue_notice',
      (recipient) => ({
        customer_name: recipient.full_name,
        account_number: recipient.account_number || '',
        bill_number: recipient.bill_number || '',
        amount: this.toCurrency(recipient.total_amount || 0),
        due_date: recipient.due_date ? new Date(recipient.due_date).toLocaleDateString() : ''
      })
    );
  }

  safeParseJSON(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch (_error) {
      return fallback;
    }
  }

  async processScheduledNotifications() {
    try {
      const tables = await executeQuery("SHOW TABLES LIKE 'scheduled_notifications'");
      if (tables.length === 0) return { processed: 0, successful: 0, failed: 0 };

      const columns = await executeQuery("SHOW COLUMNS FROM scheduled_notifications");
      const columnSet = new Set(columns.map(c => c.Field));
      const hasProcessedAt = columnSet.has('processed_at');
      const hasResult = columnSet.has('result');

      const pendingNotifications = await executeQuery(`
        SELECT * FROM scheduled_notifications
        WHERE status = 'pending' AND scheduled_time <= NOW()
        ORDER BY scheduled_time ASC LIMIT 50
      `);

      if (pendingNotifications.length === 0) return { processed: 0, successful: 0, failed: 0 };

      let successful = 0;
      let failed = 0;

      for (const notification of pendingNotifications) {
        try {
          const recipient = {
            id: notification.recipient_id,
            phone: notification.recipient_phone,
            email: notification.recipient_email
          };

          const variables = this.safeParseJSON(notification.variables, {});
          const result = await this.sendNotification(recipient, notification.notification_type, variables);

          const updateClauses = ['status = ?'];
          const updateParams = [result.success ? 'sent' : 'failed'];
          if (hasProcessedAt) updateClauses.push('processed_at = NOW()');
          if (hasResult) {
            updateClauses.push('result = ?');
            updateParams.push(JSON.stringify(result));
          }
          updateParams.push(notification.id);

          await executeQuery(
            `UPDATE scheduled_notifications SET ${updateClauses.join(', ')} WHERE id = ?`,
            updateParams
          );

          if (result.success) successful++; else failed++;
        } catch (error) {
          console.error(`Failed to process scheduled notification ${notification.id}:`, error);
          const failurePayload = JSON.stringify({ success: false, error: error.message });
          const updateClauses = ["status = 'failed'"];
          const updateParams = [];
          if (hasProcessedAt) updateClauses.push('processed_at = NOW()');
          if (hasResult) {
            updateClauses.push('result = ?');
            updateParams.push(failurePayload);
          }
          updateParams.push(notification.id);

          await executeQuery(
            `UPDATE scheduled_notifications SET ${updateClauses.join(', ')} WHERE id = ?`,
            updateParams
          );
          failed++;
        }
      }

      return { processed: pendingNotifications.length, successful, failed };
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
      return { processed: 0, successful: 0, failed: 0, error: error.message };
    }
  }

  /**
   * Updated to include the 'message' column
   */
  async logNotification(recipientId, recipientPhone, notificationType, channel, status, payload = null, metadata = null, messageContent = null) {
    try {
      const validRecipientId = (recipientId === 0 || recipientId) ? recipientId : null;
      
      const query = `
          INSERT INTO notifications_sent
            (recipient_id, recipient_phone, recipient, notification_type, channel, status, payload, metadata, message)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
      
      const recipient = recipientPhone || `User ${validRecipientId}`;
      
      // Ensure payload/metadata are strings
      const payloadStr = payload ? JSON.stringify(payload) : null;
      const metadataStr = metadata ? JSON.stringify(metadata) : null;

      await executeQuery(query, [
        validRecipientId,
        recipientPhone || null,
        recipient,
        notificationType || null,
        channel || null,
        status || null,
        payloadStr,
        metadataStr,
        messageContent || ''
      ]);
    } catch (error) {
      console.error('Notification log failed:', error.message);
    }
  }
}

module.exports = new NotificationService();