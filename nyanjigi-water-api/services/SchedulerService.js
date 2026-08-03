const cron = require('node-cron');
const { Bill, Contribution, Customer, Payment, SystemSettings } = require('../models');
const NotificationService = require('./NotificationService');
const moment = require('moment');

/**
 * Scheduler Service - Handles automated tasks and cron jobs
 */
class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Initialize scheduler with all jobs
  async initialize() {
    try {
      if (this.isInitialized) {
        console.log('Scheduler already initialized');
        return;
      }

      console.log('Initializing scheduler...');

      // Schedule core billing and fine logic
      await this.scheduleMonthlyBilling();
      // await this.scheduleMonthlyContributions();  // Disabled: manual admin trigger only
      // await this.scheduleOverdueNotifications();  // Disabled: manual admin trigger only
      // Fine application is now manual-only and must not run automatically
      // await this.scheduleFineApplication();
      await this.scheduleBillStatusUpdates();
      // Automatic scheduled notifications are disabled
      // await this.scheduleScheduledNotifications();
      await this.scheduleSystemMaintenance();

      this.isInitialized = true;
      console.log('Scheduler initialized successfully');
      console.log(`Jobs scheduled: ${this.jobs.size}`);
    } catch (error) {
      console.error('Scheduler initialization failed:', error);
      throw error;
    }
  }

  // Schedule monthly billing (1st of each month at 6:00 AM)
  async scheduleMonthlyBilling() {
    const task = cron.schedule('0 6 1 * *', async () => {
      try {
        const currentMonth = moment().startOf('month').format('YYYY-MM-DD');
        
        // Generate bills for all active customers
        const result = await Bill.generateMonthlyBills(currentMonth);
        
        console.log(`Monthly billing: ${result.generated_count} bills generated`);
        
        // Notification sending is now manual via admin API
        // if (result.notifications && result.notifications.length > 0) {
        //   const dispatch = await NotificationService.sendBillingCycleMessages(result.notifications);
        //   console.log('Bill notifications sent', dispatch.summary);
        // }
        delete result.notifications;
        
        // Log the activity
        await this.logScheduledActivity('monthly_billing', 'success', {
          bills_generated: result.generated_count,
          billing_month: currentMonth
        });
        
      } catch (error) {
        console.error('Monthly billing failed:', error);
        await this.logScheduledActivity('monthly_billing', 'failed', {
          error: error.message
        });
      }
    }, {
      scheduled: false,
      timezone: 'Africa/Nairobi'
    });

    this.jobs.set('monthly_billing', task);
    console.log('Monthly billing scheduled (1st of month at 6:00 AM)');
  }

  // DISABLED: Monthly contributions scheduling
  // Manual admin trigger only - no automatic generation
  // async scheduleMonthlyContributions() {
  //   const task = cron.schedule('0 7 1 * *', async () => {
  //     // Contribution generation and notifications are now handled manually
  //   }, {
  //     scheduled: false,
  //     timezone: 'Africa/Nairobi'
  //   });
  // }

  // DISABLED: Overdue notifications scheduling
  // Manual admin trigger only - admins will send overdue notices via API
  // async scheduleOverdueNotifications() {
  //   const task = cron.schedule('0 9 * * *', async () => {
  //     // Overdue notifications are now sent manually by admin
  //   }, {
  //     scheduled: false,
  //     timezone: 'Africa/Nairobi'
  //   });
  // }

// Calculate and apply fines after grace period has elapsed
// Fine application is now manual-only and must not run automatically.
async scheduleFineApplication() {
  console.warn('scheduleFineApplication is disabled. Fines must be applied manually by an administrator.');
}

// Validate if a bill is eligible for fine application
async validateFineApplication(billId) {
  const { executeQuery } = require('../config/database');
  
  // Check if bill exists and is eligible for fine
  const query = `
    SELECT 
      b.id,
      b.status,
      b.due_date,
      b.total_amount,
      DATEDIFF(CURDATE(), b.due_date) as days_overdue,
      EXISTS(
        SELECT 1 FROM applied_fines 
        WHERE bill_id = b.id AND status = 'pending'
      ) as has_pending_fine
    FROM bills b
    WHERE b.id = ?
  `;
  
  const result = await executeQuery(query, [billId]);
  
  if (result.length === 0) {
    return { valid: false, reason: 'Bill not found' };
  }
  
  const bill = result[0];
  
  if (bill.status === 'paid') {
    return { valid: false, reason: 'Bill is already paid' };
  }
  
  if (bill.has_pending_fine) {
    return { valid: false, reason: 'Fine already applied' };
  }
  
  if (bill.days_overdue <= 0) {
    return { valid: false, reason: 'Bill is not overdue' };
  }
  
  return { 
    valid: true, 
    bill: bill,
    days_overdue: bill.days_overdue
  };
}


  // Update bill statuses daily (daily at 8:00 AM)
  async scheduleBillStatusUpdates() {
    const task = cron.schedule('0 8 * * *', async () => {
      try {
        const updatedCount = await Bill.updateBillStatuses();
        
        if (updatedCount > 0) {
          console.log(`Updated ${updatedCount} bills to overdue status`);
        }
        
        // Log the activity
        await this.logScheduledActivity('bill_status_updates', 'success', {
          bills_updated: updatedCount
        });
        
      } catch (error) {
        console.error('Bill status updates failed:', error);
        await this.logScheduledActivity('bill_status_updates', 'failed', {
          error: error.message
        });
      }
    }, {
      scheduled: false,
      timezone: 'Africa/Nairobi'
    });

    this.jobs.set('bill_status_updates', task);
    console.log('Bill status updates scheduled (daily at 8:00 AM)');
  }

  // Process scheduled notifications (every 5 minutes)
  async scheduleScheduledNotifications() {
    console.warn('scheduleScheduledNotifications is disabled. Automated scheduled notifications are not allowed.');
  }

  // Run system maintenance tasks (daily at 2:00 AM)
  async scheduleSystemMaintenance() {
    const task = cron.schedule('0 2 * * *', async () => {
      
      try {
        const maintenanceTasks = [];
        
        // Clean up old notification logs (older than 6 months)
        const cleanupQuery = `
          DELETE FROM notifications_sent 
          WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
        `;
        const { executeQuery } = require('../config/database');
        const cleanupResult = await executeQuery(cleanupQuery);
        maintenanceTasks.push(`Cleaned up ${cleanupResult.affectedRows} old notification logs`);
        
        // Update payment statuses for very old pending payments (older than 7 days)
        const oldPaymentsQuery = `
          UPDATE payments 
          SET status = 'failed', notes = CONCAT(IFNULL(notes, ''), ' - Auto-failed after 7 days')
          WHERE status = 'pending' 
          AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        `;
        const paymentCleanup = await executeQuery(oldPaymentsQuery);
        maintenanceTasks.push(`Auto-failed ${paymentCleanup.affectedRows} old pending payments`);
        
        // Clean up processed scheduled notifications (older than 30 days)
        const scheduledCleanupQuery = `
          DELETE FROM scheduled_notifications 
          WHERE status IN ('sent', 'failed') 
          AND processed_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        `;
        try {
          const scheduledCleanup = await executeQuery(scheduledCleanupQuery);
          maintenanceTasks.push(`Cleaned up ${scheduledCleanup.affectedRows} old scheduled notifications`);
        } catch (error) {
          // Table might not exist yet
          maintenanceTasks.push('Scheduled notifications cleanup skipped (table not found)');
        }
        
        console.log('System maintenance completed');
        
        // Log the activity
        await this.logScheduledActivity('system_maintenance', 'success', {
          tasks_completed: maintenanceTasks.length,
          tasks: maintenanceTasks
        });
        
      } catch (error) {
        console.error('System maintenance failed:', error);
        await this.logScheduledActivity('system_maintenance', 'failed', {
          error: error.message
        });
      }
    }, {
      scheduled: false,
      timezone: 'Africa/Nairobi'
    });

    this.jobs.set('system_maintenance', task);
    console.log('System maintenance job scheduled (daily at 2:00 AM)');
  }

// Start all scheduled jobs
  startAll() {
    this.jobs.forEach((task, name) => {
      task.start();
    });
    
    console.log(`All ${this.jobs.size} jobs started`);
  }

  // Stop all scheduled jobs
  stopAll() {
    this.jobs.forEach((task, name) => {
      task.stop();
    });
    
    console.log('All jobs stopped');
  }

  // Start specific job
  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      return true;
    } else {
      console.error(`Job not found: ${jobName}`);
      return false;
    }
  }
  // Get job status
  getJobStatus() {
    const status = {};
    
    this.jobs.forEach((task, name) => {
      status[name] = {
        running: task.running || false,
        scheduled: true
      };
    });
    
    return status;
  }

  // Run job immediately (for testing)
  async runJobNow(jobName) {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job not found: ${jobName}`);
    }
    
    // Get the task function and execute it
    try {
      // This is a workaround since node-cron doesn't expose the task function directly
      // We'll re-implement the job logic here for manual execution
      switch (jobName) {
        case 'monthly_billing':
          await this.runMonthlyBilling();
          break;
        case 'monthly_contributions':
          await this.runMonthlyContributions();
          break;
        case 'overdue_notifications':
          await this.runOverdueNotifications();
          break;
        case 'fine_application':
          await this.runFineApplication();
          break;
        case 'scheduled_notifications':
          await NotificationService.processScheduledNotifications();
          break;
        case 'system_maintenance':
          await this.runSystemMaintenance();
          break;
        default:
          throw new Error(`No manual runner for job: ${jobName}`);
      }
    } catch (error) {
      console.error(`Job execution failed: ${jobName}`, error);
      throw error;
    }
  }

  // Manual runners for immediate execution
  async runMonthlyBilling() {
    const currentMonth = moment().startOf('month').format('YYYY-MM-DD');
    const result = await Bill.generateMonthlyBills(currentMonth);
    delete result.notifications;
    return result;
  }

  async runMonthlyContributions() {
    const currentMonth = moment().startOf('month').format('YYYY-MM-DD');
    const result = await Contribution.generateMonthlyContributions(currentMonth);
    return result;
  }

  async runOverdueNotifications() {
    const overdueBills = await Bill.getOverdueBills(500);
    const overdueContributions = await Contribution.getOverdueContributions(500);
    
    return [
      { type: 'bills', count: overdueBills.length, overdueBills },
      { type: 'contributions', count: overdueContributions.length, overdueContributions }
    ];
  }

  async runFineApplication() {
    console.warn('runFineApplication is disabled. Fine application must be done manually by an administrator.');
    return {
      eligible_bills: 0,
      applied_fines: 0,
      message: 'Automated fine application is disabled. Use the admin fine workflow instead.'
    };
  }

  async runSystemMaintenance() {
    const { executeQuery } = require('../config/database');
    const tasks = [];
    
    // Clean up old notification logs
    const cleanupQuery = `
      DELETE FROM notifications_sent 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
    `;
    const cleanupResult = await executeQuery(cleanupQuery);
    tasks.push(`Cleaned up ${cleanupResult.affectedRows} old notification logs`);
    
    // Update old pending payments
    const oldPaymentsQuery = `
      UPDATE payments 
      SET status = 'failed', notes = CONCAT(IFNULL(notes, ''), ' - Auto-failed after 7 days')
      WHERE status = 'pending' 
      AND created_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
    `;
    const paymentCleanup = await executeQuery(oldPaymentsQuery);
    tasks.push(`Auto-failed ${paymentCleanup.affectedRows} old pending payments`);
    
    return { tasks_completed: tasks.length, tasks };
  }

  // Log scheduled activity
  async logScheduledActivity(jobName, status, details = {}) {
    try {
      const { executeQuery } = require('../config/database');
      
      // Create scheduled_activities table if it doesn't exist
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS scheduled_activities (
          id INT PRIMARY KEY AUTO_INCREMENT,
          job_name VARCHAR(100) NOT NULL,
          status ENUM('success', 'failed') NOT NULL,
          details JSON NULL,
          executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_job_name (job_name),
          INDEX idx_executed_at (executed_at)
        )
      `;
      
      await executeQuery(createTableQuery);
      
      // Insert activity log
      const insertQuery = `
        INSERT INTO scheduled_activities (job_name, status, details) 
        VALUES (?, ?, ?)
      `;
      
      await executeQuery(insertQuery, [jobName, status, JSON.stringify(details)]);
      
    } catch (error) {
      console.error('Failed to log scheduled activity:', error);
      // Don't throw error as this is just for logging
    }
  }

  // Get activity logs
  async getActivityLogs(jobName = null, limit = 50) {
    try {
      const { executeQuery } = require('../config/database');
      
      let query = `
        SELECT * FROM scheduled_activities 
      `;
      const params = [];
      
      if (jobName) {
        query += 'WHERE job_name = ? ';
        params.push(jobName);
      }
      
      query += 'ORDER BY executed_at DESC LIMIT ?';
      params.push(limit);
      
      const logs = await executeQuery(query, params);
      
      return logs.map(log => ({
        ...log,
        details: log.details ? JSON.parse(log.details) : null
      }));
      
    } catch (error) {
      console.error('Failed to get activity logs:', error);
      return [];
    }
  }

  // Get scheduler statistics
  getStats() {
    const jobs = this.getJobStatus();
    const totalJobs = Object.keys(jobs).length;
    const runningJobs = Object.values(jobs).filter(job => job.running).length;
    
    return {
      total_jobs: totalJobs,
      running_jobs: runningJobs,
      stopped_jobs: totalJobs - runningJobs,
      initialized: this.isInitialized,
      jobs: jobs
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('Shutting down scheduler...');
    
    this.stopAll();
    
    // Wait a moment for jobs to stop
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    this.jobs.clear();
    this.isInitialized = false;
    
    console.log('Scheduler shutdown complete');
  }
}

// Export singleton instance
module.exports = new SchedulerService();