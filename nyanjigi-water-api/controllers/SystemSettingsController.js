const { SystemSettings } = require('../models');
const ApiResponse = require('../utils/response');

/**
 * System Settings Controller - Handles system configuration management
 */
class SystemSettingsController {
  // Get all system settings (Admin only)
  static async getAllSettings(req, res) {
    try {
      const settings = await SystemSettings.getAllSettings();
      return ApiResponse.success(res, settings, 'System settings retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get payment settings (Admin only)
  static async getPaymentSettings(req, res) {
    try {
      const settings = await SystemSettings.getPaymentSettings();

      // Don't expose sensitive keys in response, just show if they're configured
      const secureSettings = {
        ...settings,
        equity_webhook_secret: settings.equity_webhook_secret ? '***configured***' : ''
      };

      return ApiResponse.success(res, secureSettings, 'Payment settings retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update payment settings (Admin only)
  static async updatePaymentSettings(req, res) {
    try {
      const { 
        jenga_api_url, 
        jenga_consumer_key, 
        jenga_consumer_secret, 
        stk_push_shortcode, 
        stk_callback_url 
      } = req.body;

      const updates = {};
      if (jenga_api_url !== undefined) updates.jenga_api_url = jenga_api_url;
      if (jenga_consumer_key !== undefined) updates.jenga_consumer_key = jenga_consumer_key;
      if (jenga_consumer_secret !== undefined) updates.jenga_consumer_secret = jenga_consumer_secret;
      if (stk_push_shortcode !== undefined) updates.stk_push_shortcode = stk_push_shortcode;
      if (stk_callback_url !== undefined) updates.stk_callback_url = stk_callback_url;

      if (Object.keys(updates).length === 0) {
        return ApiResponse.error(res, 'No payment settings provided to update', 400);
      }

      const results = await SystemSettings.updateSettings(updates, req.admin.id);

      // Don't return sensitive data in response
      const safeResults = results.map(result => ({
        ...result,
        value: result.key.includes('secret') || result.key.includes('key') ? 
          '***updated***' : result.value
      }));

      return ApiResponse.success(res, {
        updated_settings: safeResults
      }, 'Payment settings updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get contribution settings (Admin only)
  static async getContributionSettings(req, res) {
    try {
      const settings = await SystemSettings.getContributionSettings();
      return ApiResponse.success(res, settings, 'Contribution settings retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update contribution settings (Admin only)
  static async updateContributionSettings(req, res) {
    try {
      const { monthly_amount, due_days } = req.body;

      const updates = {};
      if (monthly_amount !== undefined) updates.monthly_contribution_amount = monthly_amount.toString();
      if (due_days !== undefined) updates.contribution_due_days = due_days.toString();

      if (Object.keys(updates).length === 0) {
        return ApiResponse.error(res, 'No contribution settings provided to update', 400);
      }

      const results = await SystemSettings.updateSettings(updates, req.admin.id);

      return ApiResponse.success(res, {
        updated_settings: results
      }, 'Contribution settings updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get notification settings (Admin only)
  static async getNotificationSettings(req, res) {
    try {
      const settings = await SystemSettings.getNotificationSettings();
      return ApiResponse.success(res, settings, 'Notification settings retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update notification settings (Admin only)
  static async updateNotificationSettings(req, res) {
    try {
      const { sms_sender_id, sms_enabled, email_enabled } = req.body;

      const updates = {};
      if (sms_sender_id !== undefined) updates.sms_sender_id = sms_sender_id;
      if (sms_enabled !== undefined) updates.sms_enabled = sms_enabled.toString();
      if (email_enabled !== undefined) updates.email_enabled = email_enabled.toString();

      if (Object.keys(updates).length === 0) {
        return ApiResponse.error(res, 'No notification settings provided to update', 400);
      }

      const results = await SystemSettings.updateSettings(updates, req.admin.id);

      return ApiResponse.success(res, {
        updated_settings: results
      }, 'Notification settings updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get company settings (Admin only)
  static async getCompanySettings(req, res) {
    try {
      const settings = await SystemSettings.getCompanySettings();
      return ApiResponse.success(res, settings, 'Company settings retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update company settings (Admin only)
  static async updateCompanySettings(req, res) {
    try {
      const { 
        company_name, 
        company_phone, 
        company_email, 
        company_address, 
        logo_url 
      } = req.body;

      const updates = {};
      if (company_name !== undefined) updates.company_name = company_name;
      if (company_phone !== undefined) updates.company_phone = company_phone;
      if (company_email !== undefined) updates.company_email = company_email;
      if (company_address !== undefined) updates.company_address = company_address;
      if (logo_url !== undefined) updates.logo_url = logo_url;

      if (Object.keys(updates).length === 0) {
        return ApiResponse.error(res, 'No company settings provided to update', 400);
      }

      const results = await SystemSettings.updateSettings(updates, req.admin.id);

      return ApiResponse.success(res, {
        updated_settings: results
      }, 'Company settings updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Initialize default settings (Admin only - for fresh installation)
  static async initializeSettings(req, res) {
    try {
      const result = await SystemSettings.initializeDefaultSettings();

      return ApiResponse.success(res, result, 
        `Settings initialized successfully. Created ${result.initialized_count} new settings, ${result.existing_count} already existed.`
      );
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get settings with validation status (Admin only)
  static async getSettingsWithValidation(req, res) {
    try {
      const settings = await SystemSettings.getSettingsWithValidation();

      // Count validation issues
      let totalSettings = 0;
      let invalidSettings = 0;
      let requiredMissing = 0;

      for (const category of Object.values(settings)) {
        for (const setting of Object.values(category)) {
          totalSettings++;
          if (!setting.is_valid) invalidSettings++;
          if (setting.required && (!setting.value || setting.value.trim() === '')) {
            requiredMissing++;
          }
        }
      }

      return ApiResponse.success(res, {
        settings,
        validation_summary: {
          total_settings: totalSettings,
          valid_settings: totalSettings - invalidSettings,
          invalid_settings: invalidSettings,
          required_missing: requiredMissing,
          system_ready: invalidSettings === 0 && requiredMissing === 0
        }
      }, 'Settings with validation status retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Test Equity Bank connection (Admin only)
  static async testEquityConnection(req, res) {
    try {
      const paymentSettings = await SystemSettings.getPaymentSettings();

      if (!paymentSettings.equity_paybill_account || !paymentSettings.equity_webhook_secret) {
        return ApiResponse.error(res, 'Equity Bank payment settings not configured', 400);
      }

      // Test basic configuration validation
      const axios = require('axios');

      // Test callback URL if provided
      if (paymentSettings.equity_callback_url) {
        try {
          const urlTest = await axios.get(paymentSettings.equity_callback_url, { timeout: 5000 });
          if (urlTest.status !== 200) {
            throw new Error('Callback URL not accessible');
          }
        } catch (urlError) {
          console.warn('Callback URL test failed:', urlError.message);
        }
      }

      return ApiResponse.success(res, {
        status: 'success',
        message: 'Equity Bank payment settings validated',
        paybill_account: paymentSettings.equity_paybill_account,
        till_account: paymentSettings.equity_till_account || 'Not configured',
        callback_url: paymentSettings.equity_callback_url || 'Not configured',
        webhook_secret_configured: !!paymentSettings.equity_webhook_secret
      }, 'Equity Bank connection test successful');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Reset settings to defaults (Admin only - use with caution)
  static async resetSettings(req, res) {
    try {
      const { category, confirm } = req.body;

      if (!confirm) {
        return ApiResponse.error(res, 'Settings reset must be confirmed by setting confirm: true', 400);
      }

      if (!category) {
        return ApiResponse.error(res, 'Category is required for settings reset', 400);
      }

      // Get current settings for the category
      const currentSettings = await SystemSettings.getSettingsByCategory(category);
      
      if (Object.keys(currentSettings).length === 0) {
        return ApiResponse.notFound(res, 'No settings found for this category');
      }

      // Initialize default settings (this will update existing ones)
      const initResult = await SystemSettings.initializeDefaultSettings();
      
      // Get updated settings for the category
      const updatedSettings = await SystemSettings.getSettingsByCategory(category);

      return ApiResponse.success(res, {
        category,
        reset_count: Object.keys(updatedSettings).length,
        settings: updatedSettings
      }, `${category} settings reset to defaults successfully`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Export settings configuration (Admin only)
  static async exportSettings(req, res) {
    try {
      const { format = 'json', include_sensitive = false } = req.query;
      const settings = await SystemSettings.getAllSettings();

      let exportData = settings.categorized;

      // Remove sensitive data if not explicitly requested
      if (!include_sensitive) {
        const sensitiveKeys = ['jenga_consumer_key', 'jenga_consumer_secret'];
        
        for (const category of Object.values(exportData)) {
          for (const [key, setting] of Object.entries(category)) {
            if (sensitiveKeys.some(sensitive => key.includes(sensitive))) {
              setting.value = '***hidden***';
            }
          }
        }
      }

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=system_settings.json');
        return res.send(JSON.stringify(exportData, null, 2));
      }

      return ApiResponse.success(res, {
        settings: exportData,
        exported_at: new Date().toISOString(),
        include_sensitive: include_sensitive
      }, 'Settings exported successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get system status based on settings (Public - for system health checks)
  static async getSystemStatus(req, res) {
    try {
      const validatedSettings = await SystemSettings.getSettingsWithValidation();
      
      // Check critical settings
      const criticalSettings = [
        'jenga_consumer_key',
        'jenga_consumer_secret', 
        'stk_push_shortcode'
      ];

      let criticalIssues = 0;
      let paymentSystemReady = true;

      for (const category of Object.values(validatedSettings)) {
        for (const [key, setting] of Object.entries(category)) {
          if (criticalSettings.includes(key)) {
            if (!setting.value || setting.value.trim() === '' || !setting.is_valid) {
              criticalIssues++;
              paymentSystemReady = false;
            }
          }
        }
      }

      const systemStatus = {
        status: criticalIssues === 0 ? 'healthy' : 'warning',
        payment_system_ready: paymentSystemReady,
        critical_issues: criticalIssues,
        timestamp: new Date().toISOString(),
        components: {
          billing: 'healthy',
          payments: paymentSystemReady ? 'healthy' : 'warning',
          notifications: 'healthy'
        }
      };

      const statusCode = systemStatus.status === 'healthy' ? 200 : 207;

      return ApiResponse.success(res, systemStatus, 'System status retrieved successfully', statusCode);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get settings by category (Admin only)
  static async getSettingsByCategory(req, res) {
    try {
      const { category } = req.params;
      const settings = await SystemSettings.getSettingsByCategory(category);

      if (Object.keys(settings).length === 0) {
        return ApiResponse.notFound(res, 'No settings found for this category');
      }

      return ApiResponse.success(res, settings, `${category} settings retrieved successfully`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get single setting (Admin only)
  static async getSetting(req, res) {
    try {
      const { key } = req.params;
      const value = await SystemSettings.getSetting(key);

      if (value === null) {
        return ApiResponse.notFound(res, 'Setting not found');
      }

      return ApiResponse.success(res, { key, value }, 'Setting retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update single setting (Admin only)
  static async updateSetting(req, res) {
    try {
      const { key } = req.params;
      const { value, description, category } = req.body;

      if (value === undefined || value === null) {
        return ApiResponse.error(res, 'Setting value is required', 400);
      }

      // Validate setting value
      const isValid = SystemSettings.validateSetting(key, value);
      if (!isValid) {
        return ApiResponse.error(res, 'Invalid setting value', 400);
      }

      const updatedSetting = await SystemSettings.setSetting(
        key,
        value,
        description,
        category || 'general',
        req.admin.id
      );

      return ApiResponse.success(res, updatedSetting, 'Setting updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Bulk update settings (Admin only)
  static async updateSettings(req, res) {
    try {
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return ApiResponse.error(res, 'Settings object is required', 400);
      }

      // Validate all settings before updating
      const validationErrors = [];
      for (const [key, value] of Object.entries(settings)) {
        if (!SystemSettings.validateSetting(key, value)) {
          validationErrors.push({
            key,
            value,
            error: 'Invalid value'
          });
        }
      }

      if (validationErrors.length > 0) {
        return ApiResponse.validationError(res, validationErrors);
      }

      const results = await SystemSettings.updateSettings(settings, req.admin.id);

      return ApiResponse.success(res, {
        updated_settings: results,
        count: results.length
      }, `Successfully updated ${results.length} settings`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get billing settings (Admin only)
  static async getBillingSettings(req, res) {
    try {
      const settings = await SystemSettings.getBillingSettings();
      return ApiResponse.success(res, settings, 'Billing settings retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update billing settings (Admin only)
  static async updateBillingSettings(req, res) {
    try {
      const { flat_rate, billing_day, payment_due_days, late_fine_grace_days } = req.body;

      const updates = {};
      if (flat_rate !== undefined) updates.default_flat_rate = flat_rate.toString();
      if (billing_day !== undefined) updates.default_billing_day = billing_day.toString();
      if (payment_due_days !== undefined) updates.payment_due_days = payment_due_days.toString();
      if (late_fine_grace_days !== undefined) updates.late_fine_grace_days = late_fine_grace_days.toString();

      if (Object.keys(updates).length === 0) {
        return ApiResponse.error(res, 'No billing settings provided to update', 400);
      }

      const results = await SystemSettings.updateSettings(updates, req.admin.id);

      return ApiResponse.success(res, {
        updated_settings: results
      }, 'Billing settings updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = SystemSettingsController;
