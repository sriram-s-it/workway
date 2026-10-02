import { Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { isEmailDeliveryConfigured, sendVerificationEmail } from '../services/emailService.js';

export class AdminController {
  /**
   * Admin Dashboard Analytics & Overview Stats
   */
  static async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const usersCount = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "USER"');
      const headsCount = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "DEPARTMENT_HEAD"');
      const workersCount = await db.query('SELECT COUNT(*) as count FROM workers');
      const availableWorkers = await db.query('SELECT COUNT(*) as count FROM workers WHERE availability = "AVAILABLE"');
      const deptsCount = await db.query('SELECT COUNT(*) as count FROM departments WHERE is_active = 1');
      const servicesCount = await db.query('SELECT COUNT(*) as count FROM services WHERE is_active = 1');

      const activeBookings = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status NOT IN ("COMPLETED", "CANCELLED", "CANCELLED_WITH_FEE", "REJECTED")');
      const completedBookings = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status = "COMPLETED"');
      const cancelledBookings = await db.query('SELECT COUNT(*) as count FROM bookings WHERE status IN ("CANCELLED", "CANCELLED_WITH_FEE")');

      const revenue = await db.query('SELECT SUM(amount) as total FROM payments WHERE status = "SUCCESS"');
      const recentBookings = await db.query(
        `SELECT b.*, u.full_name as customer_name, d.name as department_name, s.name as service_name
         FROM bookings b
         JOIN users u ON b.customer_id = u.id
         JOIN departments d ON b.department_id = d.id
         JOIN services s ON b.service_id = s.id
         ORDER BY b.created_at DESC LIMIT 8`
      );

      return res.json({
        success: true,
        data: {
          metrics: {
            totalCustomers: usersCount[0]?.count || 0,
            totalDepartmentHeads: headsCount[0]?.count || 0,
            totalWorkers: workersCount[0]?.count || 0,
            availableWorkers: availableWorkers[0]?.count || 0,
            totalDepartments: deptsCount[0]?.count || 0,
            totalServices: servicesCount[0]?.count || 0,
            activeBookings: activeBookings[0]?.count || 0,
            completedBookings: completedBookings[0]?.count || 0,
            cancelledBookings: cancelledBookings[0]?.count || 0,
            totalRevenue: Number(revenue[0]?.total || 0),
          },
          recentBookings,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: List users with search, role filter
   */
  static async listUsers(req: AuthRequest, res: Response) {
    const { role, search } = req.query;

    let sql = 'SELECT id, full_name, email, phone, role, email_verified, is_active, created_at FROM users WHERE 1=1';
    const params: any[] = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (search) {
      sql += ' AND (full_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC';

    try {
      const users = await db.query(sql, params);
      return res.json({ success: true, data: users });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Create a Department Head account
   */
  static async createDepartmentHead(req: AuthRequest, res: Response) {
    const { full_name, email, phone, password, address, department_id } = req.body;

    if (!full_name || !email || !phone || !password || !address) {
      return res.status(400).json({ success: false, message: 'All fields are required.', code: 'VALIDATION_ERROR' });
    }

    try {
      if (!isEmailDeliveryConfigured()) {
        return res.status(503).json({ success: false, message: 'Email delivery must be configured before creating a Department Head.', code: 'EMAIL_DELIVERY_UNAVAILABLE' });
      }
      const cleanEmail = email.trim().toLowerCase();
      const existing = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'User with this email already exists.', code: 'EMAIL_EXISTS' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      const codeHash = await bcrypt.hash(verificationCode, 10);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      let headUserId: number;

      await db.transaction(async (trx) => {
        const userRes = await trx.execute(
          'INSERT INTO users (full_name, email, phone, password_hash, address, role, email_verified, is_active) VALUES (?, ?, ?, ?, ?, "DEPARTMENT_HEAD", 0, 1)',
          [full_name.trim(), cleanEmail, phone.trim(), passwordHash, address.trim()]
        );
        headUserId = Number(userRes.insertId);

        await trx.execute(
          'INSERT INTO email_verifications (user_id, email, code_hash, attempts_count, max_attempts, expires_at, is_used) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [headUserId, cleanEmail, codeHash, 0, 5, expiresAt, 0]
        );
        if (!await sendVerificationEmail(cleanEmail, verificationCode, full_name.trim())) {
          throw new Error('EMAIL_DELIVERY_FAILED');
        }

        // If department specified, assign head (verifying 1 Head rule)
        if (department_id) {
          const dept = await trx.query('SELECT id, name, head_user_id FROM departments WHERE id = ?', [department_id]);
          if (dept.length > 0) {
            await trx.execute('UPDATE departments SET head_user_id = ? WHERE id = ?', [headUserId, department_id]);
          }
        }

        // Audit log
        await trx.execute(
          'INSERT INTO audit_logs (admin_user_id, action, entity, entity_id, new_value) VALUES (?, "CREATE_DEPARTMENT_HEAD", "users", ?, ?)',
          [req.user!.id, String(headUserId), JSON.stringify({ full_name, email: cleanEmail, department_id })]
        );
      });

      return res.status(201).json({ success: true, message: 'Department Head created. A verification code was sent to their email.', data: { id: headUserId! } });
    } catch (error: any) {
      if (error?.message === 'EMAIL_DELIVERY_FAILED') return res.status(503).json({ success: false, message: 'Verification email could not be sent. The Head account was not created.', code: 'EMAIL_DELIVERY_FAILED' });
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Toggle user activation status
   */
  static async toggleUserStatus(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { is_active } = req.body;

    try {
      const users = await db.query('SELECT id, role, is_active FROM users WHERE id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
      }

      if (users[0].role === 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Cannot deactivate the central Admin account.', code: 'FORBIDDEN' });
      }

      const activeState = is_active ? 1 : 0;
      await db.execute('UPDATE users SET is_active = ? WHERE id = ?', [activeState, id]);

      await db.execute(
        'INSERT INTO audit_logs (admin_user_id, action, entity, entity_id, old_value, new_value) VALUES (?, "TOGGLE_USER_ACTIVE", "users", ?, ?, ?)',
        [req.user!.id, id, JSON.stringify({ is_active: users[0].is_active }), JSON.stringify({ is_active: activeState })]
      );

      return res.json({ success: true, message: `User account ${activeState ? 'activated' : 'deactivated'}.` });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: Safe customer account deletion / anonymization
   * Preserves records required for payments, transactions, and audit history.
   */
  static async deleteCustomerAccount(req: AuthRequest, res: Response) {
    const { id } = req.params;

    try {
      const users = await db.query('SELECT id, role FROM users WHERE id = ?', [id]);
      if (users.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
      }

      if (users[0].role !== 'USER') {
        return res.status(400).json({ success: false, message: 'This safe deletion flow applies to customer accounts only.', code: 'INVALID_ROLE' });
      }

      // Safe anonymization to satisfy compliance without breaking foreign keys
      const anonymizedEmail = `deleted_user_${id}@workway.anonymized`;
      await db.execute(
        'UPDATE users SET full_name = "Deactivated Customer", email = ?, phone = "0000000000", address = "Redacted", is_active = 0 WHERE id = ?',
        [anonymizedEmail, id]
      );

      await db.execute(
        'INSERT INTO audit_logs (admin_user_id, action, entity, entity_id, new_value) VALUES (?, "SAFE_DELETE_CUSTOMER", "users", ?, ?)',
        [req.user!.id, id, JSON.stringify({ anonymizedEmail })]
      );

      return res.json({ success: true, message: 'Customer account deactivated and personal records securely anonymized.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: List all bookings with full search & status filtering
   */
  static async listAllBookings(req: AuthRequest, res: Response) {
    const { status, department_id, search } = req.query;

    let sql = `
      SELECT b.*, d.name as department_name, cu.full_name as customer_name, cu.email as customer_email,
             wu.full_name as worker_name, p.status as payment_status
      FROM bookings b
      JOIN departments d ON b.department_id = d.id
      JOIN users cu ON b.customer_id = cu.id
      LEFT JOIN workers w ON b.assigned_worker_id = w.id
      LEFT JOIN users wu ON w.user_id = wu.id
      LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'SUCCESS'
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      sql += ' AND b.status = ?';
      params.push(status);
    }
    if (department_id) {
      sql += ' AND b.department_id = ?';
      params.push(department_id);
    }
    if (search) {
      sql += ' AND (b.booking_number LIKE ? OR cu.full_name LIKE ? OR b.service_name_snapshot LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY b.created_at DESC';

    try {
      const bookings = await db.query(sql, params);
      return res.json({ success: true, data: bookings });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: List all payments
   */
  static async listPayments(req: AuthRequest, res: Response) {
    try {
      const payments = await db.query(`
        SELECT p.*, b.booking_number, b.service_name_snapshot, u.full_name as customer_name, u.email as customer_email
        FROM payments p
        JOIN bookings b ON p.booking_id = b.id
        JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
      `);
      return res.json({ success: true, data: payments });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Admin: List audit logs
   */
  static async listAuditLogs(req: AuthRequest, res: Response) {
    try {
      const logs = await db.query(`
        SELECT a.*, u.full_name as admin_name, u.email as admin_email
        FROM audit_logs a
        JOIN users u ON a.admin_user_id = u.id
        ORDER BY a.created_at DESC LIMIT 100
      `);
      return res.json({ success: true, data: logs });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }
}
