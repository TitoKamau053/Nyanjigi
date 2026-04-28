const AfricasTalking = require('africastalking');
const { SystemSettings } = require('../models');

class SMSService {
constructor() {
    this.apiKey = process.env.AT_API_KEY;
    this.username = process.env.AT_USERNAME;
    this.senderId = process.env.AT_SENDER_ID || 'NYANJIGIWTR'; // Sender ID for Safaricom
    
    this.sandbox = process.env.AT_ENV === 'sandbox';
    
    this.at = null;
    this.sms = null;
    
    console.log('SMS Service Configuration:');
    console.log('AT_USERNAME:', this.username);
    console.log('AT_ENV:', process.env.AT_ENV);
    console.log('AT_SENDER_ID:', this.senderId);
    console.log('Sandbox mode:', this.sandbox);
  }

  // Initialize service with current settings
  async initialize() {
    try {
      const settings = await SystemSettings.getNotificationSettings();
      // Use environment sender ID or fallback to NYANJIGIWTR for Safaricom
      if (!this.senderId) {
        this.senderId = process.env.AT_SENDER_ID || 'NYANJIGIWTR';
      }
      
      if (!this.apiKey || !this.username) {
        console.warn("SMS Service: Africa's Talking credentials not configured");
        return false;
      }
      
      // Initialize SDK only once
      if (!this.at) {
        this.at = AfricasTalking({
          apiKey: this.apiKey,
          username: this.username
        });
        this.sms = this.at.SMS;
      }
      return true;
    } catch (error) {
      console.error('SMS Service initialization failed:', error.message);
      return false;
    }
  }

  // Send single SMS using Africa's Talking SDK
  async sendSMS(phoneNumber, message, options = {}) {
    try {
      console.log('Starting SMS send process...');
      console.log('Phone:', phoneNumber);
      console.log('Message:', message);
      console.log('Options:', options);
      
      const initialized = await this.initialize();
      if (!initialized) {
        console.error('SMS service initialization failed');
        return {
          success: false,
          error: 'SMS service not properly configured',
          message_id: null
        };
      }
      
      console.log('SMS service initialized successfully');
      console.log('API Key present:', !!this.apiKey);
      console.log('Username:', this.username);
      console.log('Sender ID:', this.senderId);
      
      if (!phoneNumber || typeof phoneNumber !== 'string') {
        return {
          success: false,
          error: 'Missing or invalid phone number',
          message_id: null,
          phone: phoneNumber
        };
      }

      let formattedPhone;
      try {
        formattedPhone = this.formatPhoneNumber(phoneNumber);
      } catch (validationError) {
        console.warn('SMS skipped due to phone validation:', {
          phone: phoneNumber,
          reason: validationError.message
        });
        return {
          success: false,
          error: validationError.message,
          message_id: null,
          phone: phoneNumber
        };
      }
      console.log('Formatted phone:', formattedPhone);
      
      const sendOptions = {
        to: [formattedPhone],
        message: message
      };
      
      // Apply sender ID for Safaricom numbers or custom sender ID if provided
      const senderIdToUse = options.senderId || (this.isSafaricomNumber(formattedPhone) ? this.senderId : null);
      if (senderIdToUse) {
        sendOptions.from = senderIdToUse;
      }
      
      console.log('Send options:', sendOptions);
      
      const response = await this.sms.send(sendOptions);
      console.log('Full API response:', JSON.stringify(response, null, 2));
      
      if (response.SMSMessageData && response.SMSMessageData.Recipients) {
        const recipient = response.SMSMessageData.Recipients[0];
        console.log('Recipient response:', recipient);
        
        if (recipient && recipient.status === 'Success') {
          return {
            success: true,
            message_id: recipient.messageId,
            cost: recipient.cost,
            status: 'sent',
            phone: formattedPhone
          };
        } else {
          const errorMsg = recipient?.status || recipient?.statusCode || 'SMS sending failed';
          if (errorMsg === 'UserInBlacklist') {
            console.warn('SMS rejected by provider (blacklist):', formattedPhone);
          } else {
            console.error('SMS sending failed with status:', errorMsg);
          }
          return {
            success: false,
            error: errorMsg,
            message_id: null,
            phone: formattedPhone
          };
        }
      } else {
        console.error('Invalid API response structure:', response);
        throw new Error('Invalid response from SMS API');
      }
    } catch (error) {
      console.error('SMS sending error details:', {
        message: error.message,
        stack: error.stack,
        phone: phoneNumber,
        apiKeyPresent: !!this.apiKey,
        username: this.username
      });
      
      return {
        success: false,
        error: error.message,
        message_id: null,
        phone: phoneNumber,
        details: {
          apiKeyPresent: !!this.apiKey,
          username: this.username,
          senderId: this.senderId
        }
      };
    }
  }

  // Send bulk SMS using Africa's Talking SDK
  async sendBulkSMS(recipients, message, options = {}) {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'SMS service not properly configured',
          results: []
        };
      }
      
      const formattedRecipients = recipients.map(phone => this.formatPhoneNumber(phone));
      const sendOptions = {
        to: formattedRecipients,
        message: message
      };
      
      // Apply sender ID for Safaricom recipients or if custom sender ID is provided
      const senderIdToUse = options.senderId || (this.senderId && this.hasSafaricomNumbers(formattedRecipients) ? this.senderId : null);
      if (!this.sandbox && senderIdToUse) {
        sendOptions.from = senderIdToUse;
      }
      
      const response = await this.sms.send(sendOptions);
      
      if (response.SMSMessageData && response.SMSMessageData.Recipients) {
        const results = response.SMSMessageData.Recipients.map(recipient => ({
          phone: recipient.number,
          success: recipient.status === 'Success',
          message_id: recipient.messageId,
          cost: recipient.cost,
          status: recipient.status
        }));
        
        const successCount = results.filter(r => r.success).length;
        return {
          success: true,
          results: results,
          summary: {
            total: results.length,
            successful: successCount,
            failed: results.length - successCount,
            total_cost: results.reduce((sum, r) => sum + parseFloat(r.cost || 0), 0)
          }
        };
      } else {
        throw new Error('Invalid response from bulk SMS API');
      }
    } catch (error) {
      console.error('Bulk SMS failed:', error.message);
      return {
        success: false,
        error: error.message,
        results: recipients.map(phone => ({
          phone,
          success: false,
          error: error.message
        }))
      };
    }
  }

  // Send password notification SMS
  async sendPasswordNotification(customer, password) {
    try {
      // Create a simple password message if no template exists
      const message = `Hello ${customer.full_name}, welcome to Nyanjigi Water! Your account password is: ${password}. Please keep it safe. Account: ${customer.account_number}`;
      
      // Try to send with template first
      const variables = {
        customer_name: customer.full_name,
        password: password,
        account_number: customer.account_number
      };
      
      const result = await this.sendTemplatedSMS(customer.phone, 'password_notification', variables);

      // CHECK IF IT FAILED AND FALLBACK
      if (!result.success) {
        console.log('Template execution failed or not found, sending direct message');
        return await this.sendSMS(customer.phone, message);
      }
      
      return result;

    } catch (error) {
      console.error('Password notification failed:', error);
      return {
        success: false,
        error: error.message,
        message_id: null
      };
    }
  }

  // Send contribution notification
  async sendContributionNotification(customer, contribution) {
    const variables = {
      customer_name: customer.full_name,
      amount: contribution.amount,
      date: new Date(contribution.date).toLocaleDateString(),
      account_number: customer.account_number
    };
    return await this.sendTemplatedSMS(customer.phone, 'contribution_notification', variables);
  }

  // Send templated SMS (bill notifications, payment confirmations, etc.)
  async sendTemplatedSMS(phoneNumber, templateType, variables = {}) {
    try {
      const template = await this.getTemplate(templateType);
      if (!template) {
        throw new Error(`SMS template '${templateType}' not found`);
      }

      const message = this.processTemplate(template, variables);
      return await this.sendSMS(phoneNumber, message);
    } catch (error) {
      console.error('Templated SMS failed:', {
        phone: phoneNumber,
        template: templateType,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        message_id: null
      };
    }
  }

  // Get SMS template from database
  async getTemplate(templateType) {
    try {
      const { executeQuery } = require('../config/database');
      const query = `
        SELECT message_template 
        FROM notification_templates 
        WHERE trigger_event = ? AND type = 'sms' AND is_active = TRUE 
        LIMIT 1
      `;
      
      const result = await executeQuery(query, [templateType]);
      return result.length > 0 ? result[0].message_template : null;
    } catch (error) {
      console.error('Template retrieval failed:', error);
      return null;
    }
  }

  // Process template with variables
  processTemplate(template, variables) {
    let message = template;
    
    // Replace template variables like {{customer_name}}, {{amount}}, etc.
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value || '');
    }
    
    // Clean up any remaining placeholders
    message = message.replace(/\{\{[^}]+\}\}/g, '');
    
    // Ensure message is within SMS length limits (160 chars for single SMS)
    if (message.length > 160) {
      console.warn(`SMS message truncated from ${message.length} to 160 characters`);
      message = message.substring(0, 157) + '...';
    }
    
    return message.trim();
  }

  // Detect if phone number is a Safaricom number (+254 7XX)
  isSafaricomNumber(phoneNumber) {
    // Safaricom uses +254 7XX prefix in Kenya
    return phoneNumber && phoneNumber.match(/^\+2547\d{8}$/) !== null;
  }

  // Check if any phone numbers in a list are Safaricom numbers
  hasSafaricomNumbers(phoneNumbers) {
    if (!Array.isArray(phoneNumbers)) return false;
    return phoneNumbers.some(phone => this.isSafaricomNumber(phone));
  }

  // Format phone number for Africa's Talking
  formatPhoneNumber(phoneNumber) {
    // Remove any spaces, dashes, or special characters
    let cleaned = phoneNumber.replace(/[\s\-\(\)]/g, '');
    
    // Remove leading + if present
    if (cleaned.startsWith('+')) {
      cleaned = cleaned.substring(1);
    }
    
    // Convert 07xxxxxxxx to +2547xxxxxxxx
    if (cleaned.startsWith('07')) {
      cleaned = '+254' + cleaned.substring(1);
    }
    
    // Convert 7xxxxxxxx to +2547xxxxxxxx
    if (cleaned.startsWith('7') && cleaned.length === 9) {
      cleaned = '+254' + cleaned;
    }
    
    // Add + prefix if not present and starts with 254
    if (cleaned.startsWith('254') && !cleaned.startsWith('+254')) {
      cleaned = '+' + cleaned;
    }
    
    // Validate format
    if (!cleaned.match(/^\+254[17]\d{8}$/)) {
      throw new Error('Invalid phone number format. Use +254XXXXXXXXX format.');
    }
    
    return cleaned;
  }

  // Get SMS delivery status using SDK
  async getDeliveryStatus(messageId) {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'SMS service not properly configured'
        };
      }

      // Use the SDK's fetch messages method
      const response = await this.sms.fetchMessages({
        lastReceivedId: 0 // This will fetch recent messages
      });

      if (response.SMSMessageData && response.SMSMessageData.Messages) {
        const message = response.SMSMessageData.Messages.find(msg => msg.id === messageId);
        if (message) {
          return {
            success: true,
            message_id: messageId,
            status: message.status,
            delivery_time: message.date,
            phone: message.from || message.to
          };
        } else {
          return {
            success: false,
            error: 'Message not found'
          };
        }
      } else {
        return {
          success: false,
          error: 'No messages found'
        };
      }
    } catch (error) {
      console.error('Delivery status query failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Check account balance using SDK
  async getAccountBalance() {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'SMS service not properly configured'
        };
      }

      // Use the application service to get user data
      const application = this.at.APPLICATION;
      const response = await application.fetchApplicationData();

      if (response.UserData) {
        return {
          success: true,
          balance: response.UserData.balance,
          currency: 'KES'
        };
      } else {
        throw new Error('Invalid response from balance API');
      }
    } catch (error) {
      console.error('Balance query failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Test SMS service connection
  async testConnection() {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          message: 'SMS service not configured',
          configured: false
        };
      }

      // In sandbox mode, skip balance check and return success
      if (this.sandbox) {
        return {
          success: true,
          message: 'Sandbox mode - Connection ready',
          balance: 'N/A (Sandbox)',
          configured: true,
          sandbox: true
        };
      }

      // Try to get account balance as a connection test for production
      const balance = await this.getAccountBalance();
      return {
        success: balance.success,
        message: balance.success ? 'Connection successful' : 'Connection failed',
        balance: balance.balance,
        configured: true,
        error: balance.error
      };
    } catch (error) {
      return {
        success: false,
        message: 'Connection test failed',
        error: error.message,
        configured: true
      };
    }
  }

  // Send bill generation notification
  async sendBillNotification(customer, bill) {
    const variables = {
      customer_name: customer.full_name,
      amount: bill.total_amount,
      period: `${new Date(bill.billing_period_start).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
      due_date: new Date(bill.due_date).toLocaleDateString(),
      account_number: customer.account_number
    };

    return await this.sendTemplatedSMS(customer.phone, 'bill_generated', variables);
  }

  // Send overdue notice
  async sendOverdueNotice(customer, bill, fine_amount = 0) {
    const variables = {
      customer_name: customer.full_name,
      amount: bill.total_amount,
      fine: fine_amount,
      days_overdue: Math.ceil((Date.now() - new Date(bill.due_date)) / (1000 * 60 * 60 * 24)),
      account_number: customer.account_number
    };

    return await this.sendTemplatedSMS(customer.phone, 'overdue_notice', variables);
  }
}

// Export singleton instance
module.exports = new SMSService();
