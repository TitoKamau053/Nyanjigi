const { executeQuery } = require('../config/database');
const ApiResponse = require('../utils/response');

class MeterReadingController {
  // Fetch customers for data entry (includes location to help the rep)
  static async getCustomersForReading(req, res) {
    try {
      const { month } = req.query; // format: YYYY-MM-01
      
        const query = `
        SELECT 
          c.id as customer_id, 
          c.account_number, 
          c.full_name, 
          c.location,
          c.meter_number, -- NEWLY ADDED
          COALESCE(
            (SELECT current_reading FROM meter_readings WHERE customer_id = c.id AND reading_month < ? ORDER BY reading_month DESC LIMIT 1), 
            0.00
          ) as previous_reading,
          mr.current_reading as already_recorded_reading
        FROM customers c
        LEFT JOIN meter_readings mr ON c.id = mr.customer_id AND mr.reading_month = ?
        WHERE c.is_active = TRUE
        ORDER BY c.location, c.full_name
      `;
      
      const customers = await executeQuery(query, [month, month]);
      return ApiResponse.success(res, customers, 'Customers fetched for meter reading');
    } catch (error) {
      return ApiResponse.error(res, error.message, 500);
    }
  }

 // Submit bulk meter readings
  static async submitReadings(req, res) {
    try {
      const { month, readings } = req.body;
      
      let extractedId = null;
      if (req.admin && req.admin.id) extractedId = req.admin.id;
      else if (req.user && req.user.id) extractedId = req.user.id;
      
      const adminId = Number(extractedId);

     if (!adminId || isNaN(adminId)) {
        return ApiResponse.error(res, `Auth failed. Could not get valid admin ID. Got: ${typeof extractedId}`, 401);
      }
      
      let successCount = 0;
      for (const reading of readings) {
        if (reading.current_reading === null || reading.current_reading === '') continue;

        const checkQuery = `SELECT id FROM meter_readings WHERE customer_id = ? AND reading_month = ?`;
        const existing = await executeQuery(checkQuery, [reading.customer_id, month]);

        if (existing.length > 0) {
          // Update existing
          await executeQuery(
            `UPDATE meter_readings SET current_reading = ?, previous_reading = ?, recorded_by = ? WHERE id = ?`,
            [reading.current_reading, reading.previous_reading, adminId, existing[0].id]
          );
        } else {
          // Insert new record
          await executeQuery(
            `INSERT INTO meter_readings (customer_id, reading_month, previous_reading, current_reading, recorded_by) VALUES (?, ?, ?, ?, ?)`,
            [reading.customer_id, month, reading.previous_reading, reading.current_reading, adminId]
          );
        }
        successCount++;
      }
      return ApiResponse.success(res, { count: successCount }, 'Readings saved successfully');
    } catch (error) {
      console.error('Submit Readings Error:', error);
      return ApiResponse.error(res, error.message, 500);
    }
  
  }
}
module.exports = MeterReadingController;