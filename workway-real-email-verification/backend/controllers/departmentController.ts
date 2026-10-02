import { Request, Response } from 'express';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';

export class DepartmentController {
  /**
   * List all departments with service count, worker count, and Head details
   */
  static async listDepartments(req: Request, res: Response) {
    try {
      const departments = await db.query(`
        SELECT d.id, d.name, d.description, d.head_user_id, d.icon, d.is_active, d.created_at,
               u.full_name as head_name, u.email as head_email, u.phone as head_phone
        FROM departments d
        LEFT JOIN users u ON d.head_user_id = u.id
        WHERE d.is_active = 1
        ORDER BY d.name ASC
      `);

      // Enrich with service counts and worker stats
      for (const dept of departments) {
        const services = await db.query('SELECT COUNT(*) as count FROM services WHERE department_id = ? AND is_active = 1', [dept.id]);
        const totalWorkers = await db.query('SELECT COUNT(*) as count FROM workers WHERE department_id = ?', [dept.id]);
        const availableWorkers = await db.query('SELECT COUNT(*) as count FROM workers WHERE department_id = ? AND availability = "AVAILABLE"', [dept.id]);

        dept.services_count = services[0]?.count || 0;
        dept.total_workers = totalWorkers[0]?.count || 0;
        dept.available_workers = availableWorkers[0]?.count || 0;
      }

      return res.json({ success: true, data: departments });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Get single department
   */
  static async getDepartmentById(req: Request, res: Response) {
    const { id } = req.params;

    try {
      const departments = await db.query(
        `SELECT d.*, u.full_name as head_name, u.email as head_email, u.phone as head_phone
         FROM departments d
         LEFT JOIN users u ON d.head_user_id = u.id
         WHERE d.id = ?`,
        [id]
      );

      if (departments.length === 0) {
        return res.status(404).json({ success: false, message: 'Department not found', code: 'NOT_FOUND' });
      }

      const services = await db.query('SELECT * FROM services WHERE department_id = ? AND is_active = 1', [id]);
      const workers = await db.query(
        `SELECT w.*, u.full_name, u.email, u.phone, p.profile_photo, p.experience_years
         FROM workers w
         JOIN users u ON w.user_id = u.id
         LEFT JOIN worker_profiles p ON w.id = p.worker_id
         WHERE w.department_id = ?`,
        [id]
      );

      return res.json({
        success: true,
        data: {
          ...departments[0],
          services,
          workers,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Create department
   */
  static async createDepartment(req: AuthRequest, res: Response) {
    const { name, description, icon, head_user_id } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Department name is required.', code: 'VALIDATION_ERROR' });
    }

    try {
      // Check duplicate name
      const existing = await db.query('SELECT id FROM departments WHERE name = ?', [name.trim()]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'A department with this name already exists.', code: 'NAME_EXISTS' });
      }

      // If head_user_id provided, enforce: ONE department head per department & head not already leading another
      if (head_user_id) {
        const user = await db.query('SELECT id, role FROM users WHERE id = ?', [head_user_id]);
        if (user.length === 0 || user[0].role !== 'DEPARTMENT_HEAD') {
          return res.status(400).json({ success: false, message: 'Selected user must have role DEPARTMENT_HEAD.', code: 'INVALID_HEAD_ROLE' });
        }

        const currentDept = await db.query('SELECT id, name FROM departments WHERE head_user_id = ?', [head_user_id]);
        if (currentDept.length > 0) {
          return res.status(400).json({
            success: false,
            message: `User is already Department Head of "${currentDept[0].name}". Business rule enforces exactly ONE Department Head per department.`,
            code: 'HEAD_ALREADY_ASSIGNED',
          });
        }
      }

      const result = await db.execute(
        'INSERT INTO departments (name, description, icon, head_user_id, is_active) VALUES (?, ?, ?, ?, 1)',
        [name.trim(), description?.trim() || null, icon || 'Wrench', head_user_id || null]
      );

      await db.execute(
        'INSERT INTO audit_logs (admin_user_id, action, entity, entity_id, new_value) VALUES (?, ?, ?, ?, ?)',
        [req.user!.id, 'CREATE_DEPARTMENT', 'departments', String(result.insertId), JSON.stringify({ name, head_user_id })]
      );

      return res.status(201).json({ success: true, message: 'Department created successfully.', data: { id: result.insertId } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Assign or change Department Head
   */
  static async assignHead(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { head_user_id } = req.body;

    try {
      const dept = await db.query('SELECT id, name, head_user_id FROM departments WHERE id = ?', [id]);
      if (dept.length === 0) {
        return res.status(404).json({ success: false, message: 'Department not found', code: 'NOT_FOUND' });
      }

      if (head_user_id) {
        const user = await db.query('SELECT id, role, full_name FROM users WHERE id = ?', [head_user_id]);
        if (user.length === 0 || user[0].role !== 'DEPARTMENT_HEAD') {
          return res.status(400).json({ success: false, message: 'User must be a registered Department Head.', code: 'INVALID_ROLE' });
        }

        // Check if head already assigned to another department
        const otherDept = await db.query('SELECT id, name FROM departments WHERE head_user_id = ? AND id != ?', [head_user_id, id]);
        if (otherDept.length > 0) {
          return res.status(400).json({
            success: false,
            message: `User is already assigned to "${otherDept[0].name}". A Department Head can only head ONE department.`,
            code: 'HEAD_ALREADY_ASSIGNED',
          });
        }
      }

      await db.execute('UPDATE departments SET head_user_id = ? WHERE id = ?', [head_user_id || null, id]);

      await db.execute(
        'INSERT INTO audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value) VALUES (?, ?, ?, ?, ?, ?)',
        [req.user!.id, 'ASSIGN_DEPARTMENT_HEAD', 'departments', id, JSON.stringify({ previous_head: dept[0].head_user_id }), JSON.stringify({ new_head: head_user_id })]
      );

      return res.json({ success: true, message: 'Department Head updated successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Update department details
   */
  static async updateDepartment(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { name, description, icon, is_active } = req.body;

    try {
      const existing = await db.query('SELECT * FROM departments WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({ success: false, message: 'Department not found', code: 'NOT_FOUND' });
      }

      await db.execute(
        'UPDATE departments SET name = ?, description = ?, icon = ?, is_active = ? WHERE id = ?',
        [name || existing[0].name, description !== undefined ? description : existing[0].description, icon || existing[0].icon, is_active !== undefined ? (is_active ? 1 : 0) : existing[0].is_active, id]
      );

      return res.json({ success: true, message: 'Department updated successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Delete department
   */
  static async deleteDepartment(req: AuthRequest, res: Response) {
    const { id } = req.params;

    try {
      // Check if workers or bookings belong to this department
      const workers = await db.query('SELECT id FROM workers WHERE department_id = ? LIMIT 1', [id]);
      const bookings = await db.query('SELECT id FROM bookings WHERE department_id = ? LIMIT 1', [id]);

      if (workers.length > 0 || bookings.length > 0) {
        // Soft delete / deactivate to preserve historical integrity
        await db.execute('UPDATE departments SET is_active = 0 WHERE id = ?', [id]);
        return res.json({
          success: true,
          message: 'Department has existing workers or booking records. Deactivated to preserve historical integrity.',
        });
      }

      await db.execute('DELETE FROM departments WHERE id = ?', [id]);
      return res.json({ success: true, message: 'Department deleted successfully.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }
}
