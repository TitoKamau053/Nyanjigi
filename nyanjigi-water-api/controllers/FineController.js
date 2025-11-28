// ...existing code...
const { Fine } = require('../models');

const ApiResponse = require('../utils/response');

/**
 * Fine Controller - Handles fines management and API endpoints
 */
class FineController {
  // Get all applied fines for all customers (Admin only)
  static async getAllFines(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;
      const fines = await Fine.getAllFines(parseInt(page), parseInt(limit));
      return ApiResponse.success(res, fines, 'All fines retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
  // Get all fine types (Admin and Customer)
  static async getFineTypes(req, res) {
    try {
      const fineTypes = await Fine.getFineTypes();
      return ApiResponse.success(res, fineTypes, 'Fine types retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get applied fines for a customer (Admin or Customer)
  static async getAppliedFines(req, res) {
    try {
      let customerId;
      if (req.customer) {
        customerId = req.customer.id;
      } else if (req.params.customerId) {
        customerId = parseInt(req.params.customerId);
      } else {
        return ApiResponse.error(res, 'Customer ID required', 400);
      }

      const { page = 1, limit = 10 } = req.query;
      const fines = await Fine.getAppliedFinesByCustomer(customerId, parseInt(page), parseInt(limit));
      return ApiResponse.success(res, fines, 'Applied fines retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Apply a new fine to a customer (Admin only)
  static async applyFine(req, res) {
    try {
      const { customerId, fineTypeId, amount, reason, appliedDate } = req.body;
      if (!customerId || !fineTypeId || !amount || !reason || !appliedDate) {
        return ApiResponse.error(res, 'Missing required fields', 400);
      }

      const fineId = await Fine.applyFine(customerId, fineTypeId, amount, reason, appliedDate);
      return ApiResponse.success(res, { fineId }, 'Fine applied successfully', 201);
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Update fine status (Admin only)
  static async updateFineStatus(req, res) {
    try {
      const { fineId } = req.params;
      const { status } = req.body;
      if (!fineId || !status) {
        return ApiResponse.error(res, 'Fine ID and status are required', 400);
      }

      await Fine.updateFineStatus(parseInt(fineId), status);
      return ApiResponse.success(res, null, 'Fine status updated successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

  // Get fine details by ID (Admin or Customer)
  static async getFineDetails(req, res) {
    try {
      const { fineId } = req.params;
      if (!fineId) {
        return ApiResponse.error(res, 'Fine ID is required', 400);
      }

      const fine = await Fine.getFineById(parseInt(fineId));
      if (!fine) {
        return ApiResponse.notFound(res, 'Fine not found');
      }

      return ApiResponse.success(res, fine, 'Fine details retrieved successfully');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }
}

module.exports = FineController;
