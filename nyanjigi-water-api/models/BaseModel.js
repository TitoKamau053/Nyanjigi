const { executeQuery, executeTransaction } = require('../config/database');

/**
 * Base Model class with common database operations
 */
class BaseModel {
  constructor(tableName) {
    this.tableName = tableName;
  }

  // Find all records with optional conditions
  async findAll(conditions = {}, options = {}) {
    try {
      let query = `SELECT * FROM ${this.tableName}`;
      const params = [];

      // Add WHERE conditions
      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map(key => `${key} = ?`)
          .join(' AND ');
        query += ` WHERE ${whereClause}`;
        params.push(...Object.values(conditions));
      }

      // Add ORDER BY
      if (options.orderBy) {
        query += ` ORDER BY ${options.orderBy}`;
        if (options.order) {
          query += ` ${options.order.toUpperCase()}`;
        }
      }

      // Add LIMIT and OFFSET for pagination
      if (options.limit) {
        const limitValue = parseInt(options.limit);
        if (!isNaN(limitValue) && limitValue > 0) {
          query += ` LIMIT ${limitValue}`;

          if (options.offset) {
            const offsetValue = parseInt(options.offset);
            if (!isNaN(offsetValue) && offsetValue >= 0) {
              query += ` OFFSET ${offsetValue}`;
            }
          }
        }
      }

      return await executeQuery(query, params);
    } catch (error) {
      console.error(`Error in ${this.tableName} findAll:`, error);
      throw error;
    }
  }

  // Find single record by ID
  async findById(id) {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = ?`;
      const result = await executeQuery(query, [id]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error(`Error in ${this.tableName} findById:`, error);
      throw error;
    }
  }

  // Find single record by conditions
  async findOne(conditions = {}) {
    try {
      const result = await this.findAll(conditions, { limit: 1 });
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error(`Error in ${this.tableName} findOne:`, error);
      throw error;
    }
  }

  // Create new record
  async create(data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      const placeholders = fields.map(() => '?').join(', ');
      
      const query = `
        INSERT INTO ${this.tableName} (${fields.join(', ')}) 
        VALUES (${placeholders})
      `;
      
      const result = await executeQuery(query, values);
      
      // Return the created record
      if (result.insertId) {
        return await this.findById(result.insertId);
      }
      return result;
    } catch (error) {
      console.error(`Error in ${this.tableName} create:`, error);
      throw error;
    }
  }

  // Update record by ID
  async update(id, data) {
    try {
      const fields = Object.keys(data);
      const values = Object.values(data);
      
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const query = `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`;
      
      await executeQuery(query, [...values, id]);
      
      // Return updated record
      return await this.findById(id);
    } catch (error) {
      console.error(`Error in ${this.tableName} update:`, error);
      throw error;
    }
  }

  // Delete record by ID
  async delete(id) {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = ?`;
      const result = await executeQuery(query, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error(`Error in ${this.tableName} delete:`, error);
      throw error;
    }
  }

  // Count records with optional conditions
  async count(conditions = {}) {
    try {
      let query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
      const params = [];

      if (Object.keys(conditions).length > 0) {
        const whereClause = Object.keys(conditions)
          .map(key => `${key} = ?`)
          .join(' AND ');
        query += ` WHERE ${whereClause}`;
        params.push(...Object.values(conditions));
      }

      const result = await executeQuery(query, params);
      return result[0].total;
    } catch (error) {
      console.error(`Error in ${this.tableName} count:`, error);
      throw error;
    }
  }

  // Execute raw query
  async rawQuery(query, params = []) {
    try {
      return await executeQuery(query, params);
    } catch (error) {
      console.error(`Error in ${this.tableName} rawQuery:`, error);
      throw error;
    }
  }

  // Bulk insert
  async bulkInsert(dataArray) {
    try {
      if (!dataArray || dataArray.length === 0) {
        throw new Error('Data array is empty');
      }

      const fields = Object.keys(dataArray[0]);
      const placeholders = fields.map(() => '?').join(', ');
      
      const query = `
        INSERT INTO ${this.tableName} (${fields.join(', ')}) 
        VALUES ${dataArray.map(() => `(${placeholders})`).join(', ')}
      `;
      
      const values = dataArray.flatMap(item => Object.values(item));
      
      return await executeQuery(query, values);
    } catch (error) {
      console.error(`Error in ${this.tableName} bulkInsert:`, error);
      throw error;
    }
  }
}

module.exports = BaseModel;