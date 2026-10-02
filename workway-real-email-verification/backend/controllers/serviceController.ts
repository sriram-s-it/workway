import { Request, Response } from 'express';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';

export class ServiceController {
  /**
   * Get all active services grouped or filtered by department
   */
  static async listServices(req: Request, res: Response) {
    const { department_id } = req.query;

    let sql = `
      SELECT s.id, s.name, s.description, s.department_id, s.fixed_price, 
             s.estimated_duration_minutes, s.is_active, s.created_at,
             d.name as department_name, d.icon as department_icon
      FROM services s
      JOIN departments d ON s.department_id = d.id
      WHERE s.is_active = 1 AND d.is_active = 1
    `;
    const params: any[] = [];

    if (department_id) {
      sql += ' AND s.department_id = ?';
      params.push(department_id);
    }

    sql += ' ORDER BY d.name ASC, s.name ASC';

    try {
      const services = await db.query(sql, params);
      return res.json({ success: true, data: services });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Get service details by ID
   */
  static async getServiceById(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const services = await db.query(
        `SELECT s.id, s.name, s.description, s.department_id, s.fixed_price, 
                s.estimated_duration_minutes, s.is_active, s.created_at,
                d.name as department_name, d.icon as department_icon
         FROM services s
         JOIN departments d ON s.department_id = d.id
         WHERE s.id = ?`,
        [id]
      );

      if (services.length === 0) {
        return res.status(404).json({ success: false, message: 'Service not found', code: 'NOT_FOUND' });
      }

      return res.json({ success: true, data: services[0] });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Create Service with Fixed Price
   */
  static async createService(req: AuthRequest, res: Response) {
    const { name, description, department_id, fixed_price, estimated_duration_minutes } = req.body;

    if (!name || !description || !department_id || fixed_price === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, department_id, and fixed_price are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const price = parseFloat(fixed_price);
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Fixed price must be a positive number.',
        code: 'INVALID_PRICE',
      });
    }

    try {
      // Verify department exists
      const depts = await db.query('SELECT id FROM departments WHERE id = ?', [department_id]);
      if (depts.length === 0) {
        return res.status(400).json({ success: false, message: 'Department not found', code: 'DEPT_NOT_FOUND' });
      }

      const result = await db.execute(
        'INSERT INTO services (name, description, department_id, fixed_price, estimated_duration_minutes, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [name.trim(), description.trim(), department_id, price, estimated_duration_minutes || 60]
      );

      // Audit log
      await db.execute(
        'INSERT INTO audit_logs (admin_user_id, action, entity, entity_id, new_value) VALUES (?, ?, ?, ?, ?)',
        [req.user!.id, 'CREATE_SERVICE', 'services', String(result.insertId), JSON.stringify({ name, fixed_price: price, department_id })]
      );

      return res.status(201).json({
        success: true,
        message: 'Service created successfully with fixed price.',
        data: { id: result.insertId, name, fixed_price: price },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Update Service
   */
  static async updateService(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { name, description, fixed_price, estimated_duration_minutes, is_active } = req.body;

    try {
      const existing = await db.query('SELECT * FROM services WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Service not found', code: 'NOT_FOUND' });
      }

      const price = fixed_price !== undefined ? parseFloat(fixed_price) : existing[0].fixed_price;
      const active = is_active !== undefined ? (is_active ? 1 : 0) : existing[0].is_active;

      await db.execute(
        'UPDATE services SET name = ?, description = ?, fixed_price = ?, estimated_duration_minutes = ?, is_active = ? WHERE id = ?',
        [name || existing[0].name, description || existing[0].description, price, estimated_duration_minutes || existing[0].estimated_duration_minutes, active, id]
      );

      // Audit log
      await db.execute(
        'INSERT INTO audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user!.id, 'UPDATE_SERVICE', 'services', id, JSON.stringify(existing[0]), JSON.stringify({ name, fixed_price: price, is_active: active })]
      );

      return res.json({ success: true, message: 'Service updated successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Delete Service (Preserves historical bookings)
   */
  static async deleteService(req: AuthRequest, res: Response) {
    const { id } = req.params;

    try {
      // Check if bookings exist for this service
      const bookings = await db.query('SELECT id FROM bookings WHERE service_id = ? LIMIT 1', [id]);
      if (bookings.length > 0) {
        // Soft delete / archive to ensure historical bookings integrity
        await db.execute('UPDATE services SET is_active = 0 WHERE id = ?', [id]);
        return res.json({
          success: true,
          message: 'Service has active booking history and was safely archived to preserve customer records.',
        });
      }

      await db.execute('DELETE FROM services WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Service deleted successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }
}
