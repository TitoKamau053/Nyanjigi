#!/usr/bin/env node

const { testConnection } = require('../config/database');
const { SchedulerService, JengaService, SMSService, NotificationService } = require('../services');
const { SystemSettings } = require('../models');
require('dotenv').config();


//Initializes all services and validates system configuration

class SystemStarter {
  constructor() {
    this.startTime = Date.now();
  }

  async start() {
    try {
      console.log('System is Live - regards from the Titus Kamau(the developer)');
      console.log(`Starting at: ${new Date().toISOString()}`);
      
      await this.checkDatabase();
      await this.validateSystemSettings();
      await this.initializeServices();
      await this.initializeScheduler();
      await this.performHealthCheck();

      const elapsed = Date.now() - this.startTime;
      console.log();
      return true;
    } catch (error) {
      console.error('System startup failed:', error.message);
      console.error(error.stack);
      return false;
    }
  }

  // Check database connection and basic structure
  async checkDatabase() {
    try {
      await testConnection();
      console.log('Database connection successful');
    } catch (error) {
      console.error('Database check failed:', error.message);
      throw error;
    }
  }

  // Validate system settings
  async validateSystemSettings() {

    try {
      const settingsValidation = await SystemSettings.getSettingsWithValidation();
      
      let totalSettings = 0;
      let invalidSettings = 0;
      let requiredMissing = 0;
      const issues = [];

      for (const [category, settings] of Object.entries(settingsValidation)) {
        for (const [key, setting] of Object.entries(settings)) {
          totalSettings++;
          
          if (!setting.is_valid) {
            invalidSettings++;
            issues.push(`${category}.${key}: Invalid value`);
          }
          
          if (setting.required && (!setting.value || setting.value.trim() === '')) {
            requiredMissing++;
            issues.push(`${category}.${key}: Required setting missing`);
          }
        }
      }

      console.log(`Settings summary: ${totalSettings} total, ${totalSettings - invalidSettings} valid, ${invalidSettings} invalid`);

      if (invalidSettings > 0 || requiredMissing > 0) {
        console.warn(' Configuration issues detected:');
        issues.forEach(issue => console.warn(`   - ${issue}`));
      } else {
        console.log(' System settings validated');
      }

    } catch (error) {
      console.warn(' Settings validation failed:', error.message);
      // Don't fail startup for settings issues
    }
  }

  // Initialize external services
  async initializeServices() {
    console.log('Initializing external services');

    // Initialize Payment Service
    try {
      const SystemSettings = require('../models/SystemSettings');
      const equitySettings = await SystemSettings.getPaymentSettings();
      
      if (equitySettings.equity_paybill_account) {
        console.log(' Equity payment configured');
        console.log(`   Paybill: ${equitySettings.equity_paybill_account}`);
      } else {
        console.log('Configure Equity settings in system settings');
      }
    } catch (error) {
      console.warn('  Equity configuration check failed:', error.message);
    }

    // Initialize SMS Service
    try {
      const smsInitialized = await SMSService.initialize();
      
      if (smsInitialized) {
        const smsTest = await SMSService.testConnection();
        
        if (smsTest.success) {
          console.log(' SMS service initialized');
        } else {
          console.warn(' SMS service connection failed:', smsTest.message);
        }
      } else {
        console.warn(' SMS service not configured');
        console.warn('Configure Africa\'s Talking credentials in environment variables');
      }
    } catch (error) {
      console.warn(' SMS service initialization failed:', error.message);
    }

    // Initialize Notification Service
    try {
      await NotificationService.initialize();
      const notificationTest = await NotificationService.testService();
      
      if (notificationTest.success) {
        console.log(' Notification service initialized');
      } else {
        console.warn(' Notification service initialization incomplete');
      }
    } catch (error) {
      console.warn(' Notification service initialization failed:', error.message);
    }
  }

  // Initialize job scheduler
  async initializeScheduler() {
    try {
      await SchedulerService.initialize();
      
      // Start scheduler only in production or if explicitly enabled
      if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
        SchedulerService.startAll();
        
        const stats = SchedulerService.getStats();
      } else {
        console.log('Set ENABLE_SCHEDULER=true to start in development');
      }
    } catch (error) {
      console.warn('Scheduler initialization failed:', error.message);
      // Don't fail startup for scheduler issues
    }
  }


  // Graceful shutdown handler
  async shutdown() {
    console.log('🛑 Initiating graceful shutdown...');

    try {
      // Stop scheduler
      await SchedulerService.shutdown();
      console.log(' Scheduler stopped');

      // Close database connections
      const { pool } = require('../config/database');
      await pool.end();
      console.log(' Database connections closed');

      console.log(' Graceful shutdown completed');
    } catch (error) {
      console.error('❌ Shutdown error:', error.message);
    }
  }
}

// Auto-start if called directly
if (require.main === module) {
  const starter = new SystemStarter();
  
  starter.start().then(success => {
    if (!success) {
      process.exit(1);
    }
  });

  // Setup graceful shutdown handlers
  process.on('SIGTERM', async () => {
    console.log('\n SIGTERM received');
    await starter.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('\n SIGINT received');
    await starter.shutdown();
    process.exit(0);
  });
}

module.exports = SystemStarter;