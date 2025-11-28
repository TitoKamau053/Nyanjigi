const { Contribution, Customer, SystemSettings } = require('../models');
const ApiResponse = require('../utils/response');
const moment = require('moment');

/**
 * Contribution Controller - Handles monthly contribution operations
 */
class ContributionController {
  // Generate monthly contributions (Admin only)
  static async generateMonthlyContributions(req, res) {
    try {
      const { contribution_month, customer_ids } = req.body;
      
      if (!contribution_month) {
        return ApiResponse.error(res, 'Contribution month is required', 400);
      }

      // Validate contribution month format
      const contributionDate = moment(contribution_month);
      if (!contributionDate.isValid()) {
        return ApiResponse.error(res, 'Invalid contribution month format. Use YYYY-MM-DD', 400);
      }

      const result = await Contribution.generateMonthlyContributions(contribution_month, customer_ids);

      return ApiResponse.success(res, result, 
        `Successfully generated ${result.generated_count} contributions for ${contributionDate.format('MMMM YYYY')}`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get all contributions with pagination and filters (Admin only)
  static async getAllContributions(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        customer_id,
        status,
        contribution_month,
        overdue,
        search
      } = req.query;

      const filters = {};
      if (customer_id) filters.customer_id = parseInt(customer_id);
      if (status) filters.status = status;
      if (contribution_month) filters.contribution_month = contribution_month;
      if (overdue === 'true') filters.overdue = true;
      if (search) filters.search = search;

      const result = await Contribution.getContributionsWithPagination(
        parseInt(page),
        parseInt(limit),
        filters
      );

      return ApiResponse.success(res, result, 'Contributions retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer contributions
  static async getCustomerContributions(req, res) {
    try {
      const { customerId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      // Verify customer exists
      const customer = await Customer.findById(parseInt(customerId));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      // If customer is accessing, ensure they can only access their own contributions
      if (req.customer && req.customer.id !== parseInt(customerId)) {
        return ApiResponse.forbidden(res, 'Cannot access other customer contributions');
      }

      const result = await Contribution.getCustomerContributions(
        parseInt(customerId),
        parseInt(page),
        parseInt(limit)
      );

      return ApiResponse.success(res, result, 'Customer contributions retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get customer contribution summary
  static async getCustomerContributionSummary(req, res) {
    try {
      const { customerId } = req.params;

      // Verify customer exists
      const customer = await Customer.findById(parseInt(customerId));
      if (!customer) {
        return ApiResponse.notFound(res, 'Customer not found');
      }

      // If customer is accessing, ensure they can only access their own data
      if (req.customer && req.customer.id !== parseInt(customerId)) {
        return ApiResponse.forbidden(res, 'Cannot access other customer data');
      }

      const summary = await Contribution.getCustomerContributionSummary(parseInt(customerId));

      return ApiResponse.success(res, {
        customer: {
          id: customer.id,
          account_number: customer.account_number,
          full_name: customer.full_name
        },
        contribution_summary: summary
      }, 'Customer contribution summary retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get overdue contributions (Admin only)
  static async getOverdueContributions(req, res) {
    try {
      const { limit = 50 } = req.query;
      const overdueContributions = await Contribution.getOverdueContributions(parseInt(limit));

      const totalOverdue = overdueContributions.reduce(
        (sum, contrib) => sum + parseFloat(contrib.outstanding_amount), 
        0
      );

      return ApiResponse.success(res, {
        contributions: overdueContributions,
        count: overdueContributions.length,
        total_outstanding: totalOverdue
      }, 'Overdue contributions retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get contribution statistics
  static async getContributionStats(req, res) {
    try {
      const { period = 'monthly' } = req.query;
      const stats = await Contribution.getContributionStats(period);

      return ApiResponse.success(res, {
        period,
        statistics: stats,
        summary: {
          total_periods: stats.length,
          average_contributions_per_period: stats.length > 0 ? 
            (stats.reduce((sum, s) => sum + s.total_contributions, 0) / stats.length).toFixed(0) : 0,
          average_collection_rate: stats.length > 0 ? 
            (stats.reduce((sum, s) => sum + parseFloat(s.collection_rate), 0) / stats.length).toFixed(2) : 0
        }
      }, 'Contribution statistics retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get contribution dashboard (Admin only)
  static async getContributionDashboard(req, res) {
    try {
      const dashboard = await Contribution.getContributionDashboard();
      return ApiResponse.success(res, dashboard, 'Contribution dashboard data retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update contribution amount system-wide (Admin only)
  static async updateContributionAmount(req, res) {
    try {
      const { new_amount, effective_from_month } = req.body;

      if (!new_amount || new_amount <= 0) {
        return ApiResponse.error(res, 'Valid contribution amount is required', 400);
      }

      if (!effective_from_month) {
        return ApiResponse.error(res, 'Effective from month is required', 400);
      }

      const effectiveDate = moment(effective_from_month);
      if (!effectiveDate.isValid()) {
        return ApiResponse.error(res, 'Invalid effective from month format', 400);
      }

      const result = await Contribution.updateContributionAmount(
        parseFloat(new_amount),
        effective_from_month
      );

      return ApiResponse.success(res, result, 
        `Contribution amount updated to KES ${new_amount} effective from ${effectiveDate.format('MMMM YYYY')}`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get monthly contribution summary (Admin only)
  static async getMonthlyContributionSummary(req, res) {
    try {
      const { year, month } = req.query;
      
      let targetDate;
      if (year && month) {
        targetDate = moment().year(parseInt(year)).month(parseInt(month) - 1);
      } else {
        targetDate = moment();
      }

      const startDate = targetDate.clone().startOf('month').format('YYYY-MM-DD');

      const summary = await Contribution.rawQuery(`
        SELECT 
          COUNT(*) as total_contributions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_contributions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_contributions,
          COUNT(CASE WHEN status = 'partial' THEN 1 END) as partial_contributions,
          COUNT(CASE WHEN status != 'completed' AND due_date < CURDATE() THEN 1 END) as overdue_contributions,
          SUM(amount_required) as total_expected,
          SUM(amount_paid) as total_collected,
          AVG(amount_required) as average_contribution_amount
        FROM contributions 
        WHERE contribution_month = ?
      `, [startDate]);

      const monthlyData = summary[0];
      const collectionRate = monthlyData.total_contributions > 0 ? 
        ((monthlyData.completed_contributions / monthlyData.total_contributions) * 100).toFixed(2) : 0;
      
      const collectionPercentage = monthlyData.total_expected > 0 ? 
        ((parseFloat(monthlyData.total_collected) / parseFloat(monthlyData.total_expected)) * 100).toFixed(2) : 0;

      return ApiResponse.success(res, {
        period: {
          month: targetDate.format('MMMM'),
          year: targetDate.year(),
          month_date: startDate
        },
        summary: {
          total_contributions: monthlyData.total_contributions,
          completed_contributions: monthlyData.completed_contributions,
          pending_contributions: monthlyData.pending_contributions,
          partial_contributions: monthlyData.partial_contributions,
          overdue_contributions: monthlyData.overdue_contributions,
          total_expected: parseFloat(monthlyData.total_expected || 0),
          total_collected: parseFloat(monthlyData.total_collected || 0),
          average_contribution_amount: parseFloat(monthlyData.average_contribution_amount || 0),
          collection_rate: collectionRate,
          collection_percentage: collectionPercentage,
          outstanding_amount: parseFloat(monthlyData.total_expected || 0) - parseFloat(monthlyData.total_collected || 0)
        }
      }, 'Monthly contribution summary retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Mark contribution as paid (Admin only - for manual payments)
  static async markContributionAsPaid(req, res) {
    try {
      const { contributionId } = req.params;
      const { amount_paid, payment_notes } = req.body;

      const contribution = await Contribution.findById(parseInt(contributionId));
      if (!contribution) {
        return ApiResponse.notFound(res, 'Contribution not found');
      }

      if (contribution.status === 'completed') {
        return ApiResponse.error(res, 'Contribution is already completed', 400);
      }

      const paymentAmount = amount_paid ? parseFloat(amount_paid) : 
        (parseFloat(contribution.amount_required) - parseFloat(contribution.amount_paid));

      if (paymentAmount <= 0) {
        return ApiResponse.error(res, 'Payment amount must be greater than 0', 400);
      }

      const newAmountPaid = parseFloat(contribution.amount_paid) + paymentAmount;
      const amountRequired = parseFloat(contribution.amount_required);

      if (newAmountPaid > amountRequired) {
        return ApiResponse.error(res, 'Payment amount exceeds required amount', 400);
      }

      let newStatus = 'partial';
      if (newAmountPaid >= amountRequired) {
        newStatus = 'completed';
      }

      const updateData = {
        amount_paid: newAmountPaid,
        status: newStatus
      };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date();
      }

      const updatedContribution = await Contribution.update(parseInt(contributionId), updateData);

      // Log the manual payment in notes
      if (payment_notes) {
        await Contribution.rawQuery(
          'INSERT INTO payment_allocations (payment_id, allocation_type, amount, notes) VALUES (NULL, ?, ?, ?)',
          ['contribution', paymentAmount, `Manual payment: ${payment_notes}. Admin: ${req.admin.id}`]
        );
      }

      return ApiResponse.success(res, {
        contribution: updatedContribution,
        payment_details: {
          amount_paid: paymentAmount,
          new_total_paid: newAmountPaid,
          remaining_amount: Math.max(0, amountRequired - newAmountPaid),
          new_status: newStatus
        }
      }, 'Contribution marked as paid successfully');
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

  // Export contributions data (Admin only)
  static async exportContributions(req, res) {
    try {
      const { 
        format = 'json', 
        status, 
        contribution_month,
        customer_id 
      } = req.query;

      const filters = {};
      if (status) filters.status = status;
      if (contribution_month) filters.contribution_month = contribution_month;
      if (customer_id) filters.customer_id = parseInt(customer_id);

      // Get all contributions matching filters
      const result = await Contribution.getContributionsWithPagination(1, 10000, filters);
      const contributions = result.contributions;

      if (format === 'csv') {
        const csv = [
          'Customer Account,Customer Name,Contribution Month,Amount Required,Amount Paid,Outstanding,Status,Due Date',
          ...contributions.map(contrib => 
            `${contrib.account_number},"${contrib.customer_name}","${moment(contrib.contribution_month).format('MMM YYYY')}",${contrib.amount_required},${contrib.amount_paid},${contrib.outstanding_amount},${contrib.status},"${moment(contrib.due_date).format('YYYY-MM-DD')}"`
          )
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=contributions.csv');
        return res.send(csv);
      }

      return ApiResponse.success(res, {
        contributions,
        count: contributions.length,
        filters: filters,
        exported_at: new Date().toISOString()
      }, 'Contributions data exported successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Bulk generate contributions for multiple months (Admin only)
  static async bulkGenerateContributions(req, res) {
    try {
      const { start_month, end_month, customer_ids } = req.body;

      if (!start_month || !end_month) {
        return ApiResponse.error(res, 'Start month and end month are required', 400);
      }

      const startDate = moment(start_month);
      const endDate = moment(end_month);

      if (!startDate.isValid() || !endDate.isValid()) {
        return ApiResponse.error(res, 'Invalid date format', 400);
      }

      if (startDate.isAfter(endDate)) {
        return ApiResponse.error(res, 'Start month must be before end month', 400);
      }

      const results = [];
      const currentDate = startDate.clone();

      while (currentDate.isSameOrBefore(endDate, 'month')) {
        try {
          const monthResult = await Contribution.generateMonthlyContributions(
            currentDate.format('YYYY-MM-DD'),
            customer_ids
          );
          
          results.push({
            month: currentDate.format('YYYY-MM-DD'),
            month_name: currentDate.format('MMMM YYYY'),
            ...monthResult
          });
        } catch (error) {
          results.push({
            month: currentDate.format('YYYY-MM-DD'),
            month_name: currentDate.format('MMMM YYYY'),
            error: error.message,
            generated_count: 0
          });
        }

        currentDate.add(1, 'month');
      }

      const totalGenerated = results.reduce((sum, r) => sum + (r.generated_count || 0), 0);

      return ApiResponse.success(res, {
        results,
        summary: {
          total_months: results.length,
          total_contributions_generated: totalGenerated,
          start_month: startDate.format('MMMM YYYY'),
          end_month: endDate.format('MMMM YYYY')
        }
      }, `Bulk contribution generation completed. Generated ${totalGenerated} contributions across ${results.length} months.`);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = ContributionController;