#!/usr/bin/env node

const { testConnection } = require('../config/database');
const { SchedulerService, JengaService, SMSService, NotificationService } = require('../services');
const { SystemSettings } = require('../models');
require('dotenv').config();

/**
 * System Startup Script
 * Initializes all services and validates system configuration
 */

class SystemStarter {
  constructor() {
    this.startTime = Date.now();
  }

  async start() {
    try {
      console.log('🚀 Nyanjigi Waters Management System');
      console.log('='.repeat(50));
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`⏰ Starting at: ${new Date().toISOString()}`);
      console.log();

      // Step 1: Database Connection
      await this.checkDatabase();

      // Step 2: System Settings Validation
      await this.validateSystemSettings();

      // Step 3: External Services Initialization
      await this.initializeServices();

      // Step 4: Scheduler Initialization
      await this.initializeScheduler();

      // Step 5: Final System Health Check
      await this.performHealthCheck();

      const elapsed = Date.now() - this.startTime;
      console.log();
      console.log('✅ System startup completed successfully');
      console.log(`⏱️ Total startup time: ${elapsed}ms`);
      console.log('🎯 System is ready to accept requests!');
      console.log('='.repeat(50));

      return true;

    } catch (error) {
      console.error('❌ System startup failed:', error.message);
      console.error(error.stack);
      return false;
    }
  }

  // Check database connection and basic structure
  async checkDatabase() {
    console.log('🔍 Checking database connection...');

    try {
      await testConnection();
      console.log('✅ Database connection successful');

      // Check if core tables exist
      const { executeQuery } = require('../config/database');
      
      const coreTables = ['customers', 'admins', 'bills', 'payments', 'system_settings'];
      const missingTables = [];

      for (const table of coreTables) {
        try {
          await executeQuery(`SELECT 1 FROM ${table} LIMIT 1`);
        } catch (error) {
          missingTables.push(table);
        }
      }

      if (missingTables.length > 0) {
        console.warn('⚠️ Missing tables detected:', missingTables.join(', '));
        console.log('💡 Run: npm run migrate to setup database schema');
      } else {
        console.log('✅ Database schema validated');
      }

    } catch (error) {
      console.error('❌ Database check failed:', error.message);
      throw error;
    }
  }

  // Validate system settings
  async validateSystemSettings() {
    console.log('⚙️ Validating system settings...');

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

      console.log(`📊 Settings summary: ${totalSettings} total, ${totalSettings - invalidSettings} valid, ${invalidSettings} invalid`);

      if (invalidSettings > 0 || requiredMissing > 0) {
        console.warn('⚠️ Configuration issues detected:');
        issues.forEach(issue => console.warn(`   - ${issue}`));
        console.log('💡 Update settings via: /api/v1/settings');
      } else {
        console.log('✅ System settings validated');
      }

    } catch (error) {
      console.warn('⚠️ Settings validation failed:', error.message);
      // Don't fail startup for settings issues
    }
  }

  // Initialize external services
  async initializeServices() {
    console.log('🔧 Initializing external services...');

    // Initialize Jenga Service
    try {
      const SystemSettings = require('../models/SystemSettings');
      const equitySettings = await SystemSettings.getPaymentSettings();
      
      if (equitySettings.equity_paybill_account) {
        console.log('✅ Equity payment configured');
        console.log(`   Paybill: ${equitySettings.equity_paybill_account}`);
      } else {
        console.warn('⚠️  Equity payment not configured');
        console.log('💡 Configure Equity settings in system settings');
      }
    } catch (error) {
      console.warn('⚠️  Equity configuration check failed:', error.message);
    }

    // Initialize SMS Service
    try {
      const smsInitialized = await SMSService.initialize();
      
      if (smsInitialized) {
        const smsTest = await SMSService.testConnection();
        
        if (smsTest.success) {
          console.log('✅ SMS service initialized');
        } else {
          console.warn('⚠️ SMS service connection failed:', smsTest.message);
        }
      } else {
        console.warn('⚠️ SMS service not configured');
        console.warn('💡 Configure Africa\'s Talking credentials in environment variables');
      }
    } catch (error) {
      console.warn('⚠️ SMS service initialization failed:', error.message);
    }

    // Initialize Notification Service
    try {
      await NotificationService.initialize();
      const notificationTest = await NotificationService.testService();
      
      if (notificationTest.success) {
        console.log('✅ Notification service initialized');
      } else {
        console.warn('⚠️ Notification service initialization incomplete');
      }
    } catch (error) {
      console.warn('⚠️ Notification service initialization failed:', error.message);
    }
  }

  // Initialize job scheduler
  async initializeScheduler() {
    console.log('📅 Initializing job scheduler...');

    try {
      await SchedulerService.initialize();
      
      // Start scheduler only in production or if explicitly enabled
      if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
        SchedulerService.startAll();
        console.log('✅ Job scheduler started');
        
        const stats = SchedulerService.getStats();
        console.log(`📊 Scheduler stats: ${stats.running_jobs}/${stats.total_jobs} jobs running`);
      } else {
        console.log('ℹ️ Job scheduler initialized but not started (development mode)');
        console.log('💡 Set ENABLE_SCHEDULER=true to start in development');
      }
    } catch (error) {
      console.warn('⚠️ Scheduler initialization failed:', error.message);
      // Don't fail startup for scheduler issues
    }
  }

  // Perform final health check
  async performHealthCheck() {
    console.log('🩺 Performing system health check...');

    const healthStatus = {
      database: 'healthy',
      jenga_api: 'unknown',
      sms_service: 'unknown',
      scheduler: 'unknown',
      overall: 'healthy'
    };

    // Database health
    try {
      await testConnection();
      healthStatus.database = 'healthy';
    } catch (error) {
      healthStatus.database = 'unhealthy';
      healthStatus.overall = 'degraded';
    }

    // Jenga API health
    try {
      const jengaStatus = await JengaService.testConnection();
      healthStatus.jenga_api = jengaStatus.success ? 'healthy' : 'degraded';
    } catch (error) {
      healthStatus.jenga_api = 'degraded';
    }

    // SMS service health
    try {
      const smsStatus = await SMSService.testConnection();
      healthStatus.sms_service = smsStatus.success ? 'healthy' : 'degraded';
    } catch (error) {
      healthStatus.sms_service = 'degraded';
    }

    // Scheduler health
    try {
      const schedulerStats = SchedulerService.getStats();
      healthStatus.scheduler = schedulerStats.initialized ? 'healthy' : 'degraded';
    } catch (error) {
      healthStatus.scheduler = 'degraded';
    }

    // Overall health assessment
    const degradedServices = Object.values(healthStatus).filter(status => 
      status === 'degraded' || status === 'unhealthy'
    ).length;

    if (degradedServices > 1) {
      healthStatus.overall = 'degraded';
    }

    // Display health summary
    console.log('📊 System Health Summary:');
    Object.entries(healthStatus).forEach(([service, status]) => {
      const icon = status === 'healthy' ? '✅' : status === 'degraded' ? '⚠️' : '❌';
      console.log(`   ${icon} ${service}: ${status}`);
    });

    return healthStatus;
  }

  // Graceful shutdown handler
  async shutdown() {
    console.log('🛑 Initiating graceful shutdown...');

    try {
      // Stop scheduler
      await SchedulerService.shutdown();
      console.log('✅ Scheduler stopped');

      // Close database connections
      const { pool } = require('../config/database');
      await pool.end();
      console.log('✅ Database connections closed');

      console.log('✅ Graceful shutdown completed');
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
    console.log('\n🛑 SIGTERM received');
    await starter.shutdown();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('\n🛑 SIGINT received');
    await starter.shutdown();
    process.exit(0);
  });
}

module.exports = SystemStarter;