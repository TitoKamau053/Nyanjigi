const BaseModel = require('./BaseModel');
const { executeQuery } = require('../config/database');

/**
 * System Settings Model - Manages application configuration
 */
class SystemSettings extends BaseModel {
  constructor() {
    super('system_settings');
  }

  // Get all settings as key-value pairs
  async getAllSettings() {
    try {
      const settings = await this.findAll({}, { orderBy: 'category, setting_key' });
      
      // Convert to key-value object
      const settingsMap = {};
      const categorized = {};

      settings.forEach(setting => {
        settingsMap[setting.setting_key] = setting.setting_value;
        
        if (!categorized[setting.category]) {
          categorized[setting.category] = {};
        }
        categorized[setting.category][setting.setting_key] = {
          value: setting.setting_value,
          description: setting.description,
          updated_at: setting.updated_at
        };
      });

      return {
        flat: settingsMap,
        categorized: categorized,
        all: settings
      };
    } catch (error) {
      console.error('Error getting all settings:', error);
      throw error;
    }
  }

  // Get settings by category
  async getSettingsByCategory(category) {
    try {
      const settings = await this.findAll({ category }, { orderBy: 'setting_key' });
      
      const categorySettings = {};
      settings.forEach(setting => {
        categorySettings[setting.setting_key] = {
          value: setting.setting_value,
          description: setting.description,
          updated_at: setting.updated_at
        };
      });

      return categorySettings;
    } catch (error) {
      console.error('Error getting settings by category:', error);
      throw error;
    }
  }

  // Get single setting value
  async getSetting(key) {
    try {
      const setting = await this.findOne({ setting_key: key });
      return setting ? setting.setting_value : null;
    } catch (error) {
      console.error('Error getting setting:', error);
      throw error;
    }
  }

  // Update or create setting
  async setSetting(key, value, description = null, category = 'general', updatedBy = null) {
    try {
      const existingSetting = await this.findOne({ setting_key: key });
      
      if (existingSetting) {
        // Update existing setting
        const updateData = {
          setting_value: value.toString(),
          updated_by: updatedBy
        };
        
        if (description !== null) {
          updateData.description = description;
        }
        
        if (category !== 'general') {
          updateData.category = category;
        }

        return await this.update(existingSetting.id, updateData);
      } else {
        // Create new setting
        const newSetting = {
          setting_key: key,
          setting_value: value.toString(),
          description: description || `Setting for ${key}`,
          category: category,
          updated_by: updatedBy
        };
        
        return await this.create(newSetting);
      }
    } catch (error) {
      console.error('Error setting value:', error);
      throw error;
    }
  }

  // Bulk update settings
  async updateSettings(settingsObject, updatedBy = null) {
    try {
      const results = [];
      
      for (const [key, value] of Object.entries(settingsObject)) {
        const result = await this.setSetting(key, value, null, 'general', updatedBy);
        results.push({
          key,
          value,
          success: true,
          setting: result
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    }
  }

  // Get billing settings
  async getBillingSettings() {
    try {
      const billingSettings = await this.getSettingsByCategory('billing');
      
      return {
        flat_rate: parseFloat(billingSettings.default_flat_rate?.value || '300.00'),
        billing_day: parseInt(billingSettings.default_billing_day?.value || '1'),
        payment_due_days: parseInt(billingSettings.payment_due_days?.value || '30'),
        late_fine_grace_days: parseInt(billingSettings.late_fine_grace_days?.value || '7')
      };
    } catch (error) {
      console.error('Error getting billing settings:', error);
      throw error;
    }
  }

  // Get payment settings (Equity Bank external payment configuration)
async getPaymentSettings() {
  try {
    const paymentSettings = await this.getSettingsByCategory('payments');
    
    return {
      // Equity Bank external payment settings only
      equity_paybill_account: paymentSettings.equity_paybill_account?.value || '247247',
      equity_callback_url: paymentSettings.equity_callback_url?.value || '',
      equity_webhook_secret: paymentSettings.equity_webhook_secret?.value || ''
    };
  } catch (error) {
    console.error('Error getting payment settings:', error);
    throw error;
  }
}

  // Get contribution settings
  async getContributionSettings() {
    try {
      const contributionSettings = await this.getSettingsByCategory('contributions');
      
      return {
        monthly_amount: parseFloat(contributionSettings.monthly_contribution_amount?.value || '100.00'),
        due_days: parseInt(contributionSettings.contribution_due_days?.value || '30'),
        target_amount: parseFloat(contributionSettings.total_contribution_target?.value || '18500.00')
      };
    } catch (error) {
      console.error('Error getting contribution settings:', error);
      throw error;
    }
  }

  // Get notification settings
  async getNotificationSettings() {
    try {
      const notificationSettings = await this.getSettingsByCategory('notifications');
      
      return {
        sms_sender_id: notificationSettings.sms_sender_id?.value || 'NYANJIGI',
        sms_enabled: notificationSettings.sms_enabled?.value === 'true',
        email_enabled: notificationSettings.email_enabled?.value === 'true'
      };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      throw error;
    }
  }

  // Get company information
  async getCompanySettings() {
    try {
      const generalSettings = await this.getSettingsByCategory('general');
      
      return {
        company_name: generalSettings.company_name?.value || 'Nyanjigi Waters Management System',
        company_phone: generalSettings.company_phone?.value || '+254700000000',
        company_email: generalSettings.company_email?.value || 'info@nyanjigi.co.ke',
        company_address: generalSettings.company_address?.value || '',
        logo_url: generalSettings.logo_url?.value || ''
      };
    } catch (error) {
      console.error('Error getting company settings:', error);
      throw error;
    }
  }

  // Initialize default settings (for fresh installation)
  async initializeDefaultSettings() {
    try {
      const defaultSettings = [
        // General settings
        { key: 'company_name', value: 'Nyanjigi Waters Management System', category: 'general', description: 'Company name for billing and notifications' },
        { key: 'company_phone', value: '+254700000000', category: 'general', description: 'Company contact phone number' },
        { key: 'company_email', value: 'info@nyanjigi.co.ke', category: 'general', description: 'Company contact email' },
        
        // Billing settings
        { key: 'default_flat_rate', value: '300.00', category: 'billing', description: 'Default monthly flat rate billing amount' },
        { key: 'default_billing_day', value: '1', category: 'billing', description: 'Day of month to generate bills (1-28)' },
        { key: 'payment_due_days', value: '30', category: 'billing', description: 'Days after bill generation for payment due date' },
        { key: 'late_fine_grace_days', value: '7', category: 'billing', description: 'Grace period days before applying late payment fines' },
        
        // Contribution settings
        { key: 'monthly_contribution_amount', value: '100.00', category: 'contributions', description: 'Suggested monthly contribution amount' },
        { key: 'contribution_due_days', value: '30', category: 'contributions', description: 'Days after month start for contribution due date' },
        { key: 'total_contribution_target', value: '18500.00', category: 'contributions', description: 'Total contribution target per customer after installation' },
        
        { 
          key: 'equity_paybill_account', 
          value: '247247', 
          category: 'payments', 
          description: 'Equity Bank Paybill account number' 
        },
        {
          key: 'equity_callback_url',
          value: 'https://yourdomain.com/api/v1/equity/callback',
          category: 'payments',
          description: 'Callback URL for Equity payment notifications'
        },
        {
          key: 'equity_webhook_secret',
          value: '',
          category: 'payments',
          description: 'Secret key for validating Equity webhooks'
        },
        
        // Notification settings
        { key: 'sms_sender_id', value: 'NYANJIGI', category: 'notifications', description: 'SMS sender ID for outgoing messages' },
        { key: 'sms_enabled', value: 'true', category: 'notifications', description: 'Enable/disable SMS notifications' },
        { key: 'email_enabled', value: 'false', category: 'notifications', description: 'Enable/disable email notifications' }
      ];

      const results = [];
      
      for (const setting of defaultSettings) {
        const existing = await this.getSetting(setting.key);
        
        if (!existing) {
          const created = await this.setSetting(
            setting.key, 
            setting.value, 
            setting.description, 
            setting.category
          );
          results.push({ key: setting.key, action: 'created', setting: created });
        } else {
          results.push({ key: setting.key, action: 'exists', value: existing });
        }
      }
      
      return {
        initialized_count: results.filter(r => r.action === 'created').length,
        existing_count: results.filter(r => r.action === 'exists').length,
        results
      };
    } catch (error) {
      console.error('Error initializing default settings:', error);
      throw error;
    }
  }

 
  static async getNotificationSettings() {
    try {
      const { executeQuery } = require('../config/database');
      
      // Try to get settings from database
      const query = `
        SELECT setting_key, setting_value 
        FROM system_settings 
        WHERE setting_key IN ('sms_sender_id', 'sms_enabled', 'email_enabled')
      `;
      
      const results = await executeQuery(query);
      
      // Convert to object
      const settings = {};
      results.forEach(row => {
        settings[row.setting_key] = row.setting_value;
      });
      
      // Return defaults if no settings found
      return {
        sms_sender_id: settings.sms_sender_id || 'NYANJIGI',
        sms_enabled: settings.sms_enabled !== 'false', // default to true
        email_enabled: settings.email_enabled !== 'false' // default to true
      };
    } catch (error) {
      console.error('Failed to get notification settings:', error);
      // Return defaults on error
      return {
        sms_sender_id: 'NYANJIGI',
        sms_enabled: true,
        email_enabled: true
      };
    }
  }

  // Validate setting value based on key
  validateSetting(key, value) {
    const validations = {
      // Numeric validations
      'default_flat_rate': (val) => !isNaN(val) && parseFloat(val) >= 0,
      'monthly_contribution_amount': (val) => !isNaN(val) && parseFloat(val) >= 0,
      'default_billing_day': (val) => !isNaN(val) && parseInt(val) >= 1 && parseInt(val) <= 28,
      'payment_due_days': (val) => !isNaN(val) && parseInt(val) >= 1 && parseInt(val) <= 365,
      'contribution_due_days': (val) => !isNaN(val) && parseInt(val) >= 1 && parseInt(val) <= 365,
      'late_fine_grace_days': (val) => !isNaN(val) && parseInt(val) >= 0 && parseInt(val) <= 30,
      
      // Boolean validations
      'sms_enabled': (val) => val === 'true' || val === 'false',
      'email_enabled': (val) => val === 'true' || val === 'false',
      
      // Email validation
      'company_email': (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
      
      // Phone validation (basic)
      'company_phone': (val) => /^\+?[1-9]\d{1,14}$/.test(val.replace(/\s/g, '')),
      
      // URL validation
      'equity_callback_url': (val) => !val || /^https?:\/\/.+/.test(val),

      // Account number validation (should be numeric)
      'equity_paybill_account': (val) => !val || /^\d+$/.test(val),
      'equity_till_account': (val) => !val || /^\d+$/.test(val)
    };

    if (validations[key]) {
      return validations[key](value);
    }
    
    // Default validation - non-empty string
    return value && value.toString().trim().length > 0;
  }

  // Get settings with validation status
  async getSettingsWithValidation() {
    try {
      const allSettings = await this.getAllSettings();
      
      const validatedSettings = {};
      
      for (const [category, settings] of Object.entries(allSettings.categorized)) {
        validatedSettings[category] = {};
        
        for (const [key, setting] of Object.entries(settings)) {
          validatedSettings[category][key] = {
            ...setting,
            is_valid: this.validateSetting(key, setting.value),
            required: ['equity_paybill_account', 'equity_webhook_secret'].includes(key)
          };
        }
      }
      
      return validatedSettings;
    } catch (error) {
      console.error('Error getting settings with validation:', error);
      throw error;
    }
  }

  static async testEquityConnection(req, res) {
  try {
    const paymentSettings = await SystemSettings.getPaymentSettings();
    
    if (!paymentSettings.equity_paybill_account) {
      return ApiResponse.error(res, 'Equity paybill account not configured', 400);
    }
    
    // Basic validation
    const isValid = /^\d+$/.test(paymentSettings.equity_paybill_account);
    
    if (!isValid) {
      return ApiResponse.error(res, 'Invalid paybill account format', 400);
    }
    
    return ApiResponse.success(res, {
      status: 'configured',
      paybill_account: paymentSettings.equity_paybill_account,
      callback_url: paymentSettings.equity_callback_url || 'Not configured',
      webhook_secret_configured: !!paymentSettings.equity_webhook_secret
    }, 'Equity payment configuration validated');
  } catch (error) {
    return ApiResponse.error(res, error.message, 500);
  }
}
}

module.exports = new SystemSettings();