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
      await this.scheduleFineApplication();
      await this.scheduleBillStatusUpdates();
      await this.scheduleScheduledNotifications();
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
async scheduleFineApplication() {
  const task = cron.schedule('0 10 * * *', async () => {
    try {
      // Get system settings
      const billingSettings = await SystemSettings.getBillingSettings();
      const graceDays = billingSettings.late_fine_grace_days || 5;
      
      // Get bills that are overdue AFTER grace period
      const overdueQuery = `
        SELECT 
          b.id as bill_id,
          b.bill_number,
          b.total_amount,
          b.due_date,
          b.customer_id,
          c.full_name,
          c.phone,
          c.account_number,
          DATEDIFF(CURDATE(), b.due_date) as days_past_due,
          -- Check if fine already applied
          EXISTS(
            SELECT 1 FROM applied_fines af 
            WHERE af.bill_id = b.id 
            AND af.fine_type_id = (
              SELECT id FROM fine_types 
              WHERE fine_type = 'late_payment' 
              LIMIT 1
            )
          ) as fine_exists
        FROM bills b
        JOIN customers c ON b.customer_id = c.id
        WHERE b.status IN ('pending', 'overdue', 'partially_paid')
        AND DATE_ADD(b.due_date, INTERVAL ? DAY) < CURDATE()
        AND c.is_active = TRUE
        HAVING fine_exists = 0
        ORDER BY b.due_date ASC
        LIMIT 100
      `;
      
      const { executeQuery } = require('../config/database');
      const overdueBills = await executeQuery(overdueQuery, [graceDays]);
      
      if (overdueBills.length === 0) {
        console.log('No bills eligible for fine application');
        await this.logScheduledActivity('fine_application', 'success', {
          fines_applied: 0,
          grace_period_days: graceDays,
          message: 'No eligible bills found'
        });
        return;
      }
      
      console.log(`Found ${overdueBills.length} bills eligible for fines`);
      
      // Get late payment fine type
      const fineTypeQuery = `
        SELECT * FROM fine_types 
        WHERE fine_type = 'late_payment' 
        AND is_active = TRUE 
        LIMIT 1
      `;
      const fineTypes = await executeQuery(fineTypeQuery);
      
      if (fineTypes.length === 0) {
        console.warn('No active late payment fine type found');
        await this.logScheduledActivity('fine_application', 'success', {
          fines_applied: 0,
          message: 'Skipped: late payment fine type not configured'
        });
        return;
      }
      
      const fineType = fineTypes[0];
      let appliedFines = 0;
      let failedFines = 0;
      const fineDetails = [];
      
      // Process each overdue bill
      for (const bill of overdueBills) {
        try {
          // Calculate fine amount
          let fineAmount = parseFloat(fineType.amount);
          
          if (fineType.is_percentage) {
            fineAmount = (parseFloat(bill.total_amount) * fineAmount) / 100;
          }
          
          // Minimum fine amount validation
          if (fineAmount < 1) {
            console.warn(`Skipping fine for bill ${bill.bill_number}: Amount too small (${fineAmount})`);
            continue;
          }
          
          // Apply fine
          const applyFineQuery = `
            INSERT INTO applied_fines 
            (customer_id, bill_id, fine_type_id, amount, reason, applied_date, status) 
            VALUES (?, ?, ?, ?, ?, CURDATE(), 'pending')
          `;
          
          const reason = `Late payment fine for bill ${bill.bill_number}. ` +
                        `Due: ${moment(bill.due_date).format('MMM DD, YYYY')}. ` +
                        `${bill.days_past_due} days overdue (${graceDays} days grace period).`;
          
          await executeQuery(applyFineQuery, [
            bill.customer_id,
            bill.bill_id,
            fineType.id,
            fineAmount,
            reason
          ]);
          
          // Update bill status to overdue if still pending
          if (bill.status === 'pending') {
            await Bill.updateBillStatus(bill.bill_id, 'overdue');
          }
          
          appliedFines++;
          
          fineDetails.push({
            bill_number: bill.bill_number,
            customer: bill.full_name,
            account: bill.account_number,
            days_overdue: bill.days_past_due,
            fine_amount: fineAmount
          });
          
          console.log(`Applied fine of KES ${fineAmount} to bill ${bill.bill_number}`);
          
        } catch (error) {
          failedFines++;
          console.error(`Failed to apply fine for bill ${bill.bill_id}:`, error.message);
        }
      }
      
      // Log activity with detailed summary
      await this.logScheduledActivity('fine_application', 'success', {
        fines_applied: appliedFines,
        fines_failed: failedFines,
        grace_period_days: graceDays,
        eligible_bills: overdueBills.length,
        fine_type: fineType.fine_name,
        fine_amount: fineType.amount,
        is_percentage: fineType.is_percentage,
        details: fineDetails.slice(0, 10) // Log first 10 for audit
      });
      
      console.log(`Fine application completed: ${appliedFines} applied, ${failedFines} failed`);
      
      // Notification sending for fines is now manual via admin API
      // if (appliedFines > 0 && overdueBills.length > 0) {
      //   Admins will send fine notifications manually to customers
      // }
      
    } catch (error) {
      console.error('Fine application failed:', error);
      await this.logScheduledActivity('fine_application', 'failed', {
        error: error.message,
        stack: error.stack
      });
    }
  }, {
    scheduled: false,
    timezone: 'Africa/Nairobi'
  });

  this.jobs.set('fine_application', task);
  console.log('Fine application scheduled (daily at 10:00 AM)');
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
    const task = cron.schedule('*/5 * * * *', async () => {
      try {
        const result = await NotificationService.processScheduledNotifications();
        
        if (result.processed > 0) {
          console.log(`Processed ${result.processed} scheduled notifications`);
        }
      } catch (error) {
        console.error('Scheduled notifications processing failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Africa/Nairobi'
    });

    this.jobs.set('scheduled_notifications', task);
    console.log('Scheduled notifications processor running (every 5 minutes)');
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
    
    console.log(`All ${this.jobs.size} jobs started`);} // Stop all scheduled jobs\n  stopAll() {\n    this.jobs.forEach((task, name) => {\n      task.stop();\n    });\n    \n    console.log('All jobs stopped');\n  }\n\n  // Start specific job\n  startJob(jobName) {\n    const job = this.jobs.get(jobName);\n    if (job) {\n      job.start();\n      return true;\n    } else {\n      console.error(`Job not found: ${jobName}`);\n      return false;\n    }\n  }\n\n  // Stop specific job\n  stopJob(jobName) {\n    const job = this.jobs.get(jobName);\n    if (job) {\n      job.stop();\n      return true;\n    } else {\n      console.error(`Job not found: ${jobName}`);\n      return false;\n    }\n  }

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
        
        if (result.notifications && result.notifications.length > 0) {
          await NotificationService.sendBillingCycleMessages(result.notifications);
        }
        delete result.notifications;
        
        return result;
  }

  async runMonthlyContributions() {
    const currentMonth = moment().startOf('month').format('YYYY-MM-DD');
    const result = await Contribution.generateMonthlyContributions(currentMonth);
    
    if (result.generated_count > 0) {
      const contributions = await Contribution.getContributionsWithPagination(1, result.generated_count, {
        contribution_month: currentMonth
      });
      
      if (contributions.contributions && contributions.contributions.length > 0) {
        await NotificationService.sendContributionReminders(contributions.contributions);
      }
    }
    
    return result;
  }

  async runOverdueNotifications() {
    const overdueBills = await Bill.getOverdueBills(500);
    const overdueContributions = await Contribution.getOverdueContributions(500);
    
    const results = [];
    
    if (overdueBills.length > 0) {
      const billResult = await NotificationService.sendOverdueNotices(overdueBills);
      results.push({ type: 'bills', count: overdueBills.length, result: billResult });
    }
    
    if (overdueContributions.length > 0) {
      const contribResult = await NotificationService.sendContributionReminders(overdueContributions);
      results.push({ type: 'contributions', count: overdueContributions.length, result: contribResult });
    }
    
    return results;
  }

  async runFineApplication() {
    // Implementation similar to the scheduled task
    const billingSettings = await SystemSettings.getBillingSettings();
    const gracePeriods = billingSettings.late_fine_grace_days || 5; // Changed to 5 days as per requirements
    
    const { executeQuery } = require('../config/database');
    
    const overdueQuery = `
      SELECT b.*, c.full_name, c.phone, c.account_number
      FROM bills b
      JOIN customers c ON b.customer_id = c.id
      WHERE b.due_date < DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND b.status IN ('pending', 'overdue')
      AND c.is_active = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM applied_fines af 
        WHERE af.bill_id = b.id 
        AND af.fine_type_id = (SELECT id FROM fine_types WHERE fine_type = 'late_payment' LIMIT 1)
      )
      LIMIT 100
    `;
    
    const overdueBills = await executeQuery(overdueQuery, [gracePeriods]);
    let appliedFines = 0;
    
    if (overdueBills.length > 0) {
      const fineTypeQuery = 'SELECT * FROM fine_types WHERE fine_type = "late_payment" AND is_active = TRUE LIMIT 1';
      const fineTypes = await executeQuery(fineTypeQuery);
      
      if (fineTypes.length > 0) {
        const fineType = fineTypes[0];
        
        for (const bill of overdueBills) {
          try {
            let fineAmount = parseFloat(fineType.amount);
            if (fineType.is_percentage) {
              fineAmount = (parseFloat(bill.total_amount) * fineAmount) / 100;
            }
            
            const applyFineQuery = `
              INSERT INTO applied_fines 
              (customer_id, bill_id, fine_type_id, amount, reason, applied_date, status) 
              VALUES (?, ?, ?, ?, ?, CURDATE(), 'pending')
            `;
            
            await executeQuery(applyFineQuery, [
              bill.customer_id,
              bill.id,
              fineType.id,
              fineAmount,
              `Late payment fine for bill ${bill.bill_number}`
            ]);
            
            await Bill.updateBillStatus(bill.id, 'overdue');
            appliedFines++;
            
          } catch (error) {
            console.error(`Failed to apply fine for bill ${bill.id}:`, error);
          }
        }
      }
    }
    
    return { eligible_bills: overdueBills.length, applied_fines: appliedFines };
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