import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';
import { isEmailDeliveryConfigured, sendVerificationEmail, sendWorkerAssignmentEmail } from '../services/emailService.js';
import { emitBookingUpdate, emitToUser } from '../services/socketService.js';

export class HeadController {
  /**
   * Head Dashboard: Stats, pending bookings, active workers
   */
  static async getDashboard(req: AuthRequest, res: Response) {
    const headUserId = req.user!.id;

    try {
      const depts = await db.query('SELECT * FROM departments WHERE head_user_id = ?', [headUserId]);
      if (depts.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You are not assigned as Head of any department.',
          code: 'NO_DEPARTMENT_ASSIGNED',
        });
      }

      const department = depts[0];

      // Pending approval or pending assignment
      const pendingBookingRows = await db.query(
        `SELECT b.*, u.full_name as customer_name, s.name as service_name
         FROM bookings b
         JOIN users u ON b.customer_id = u.id
         JOIN services s ON b.service_id = s.id
         WHERE b.department_id = ? AND b.status IN ('PENDING_HEAD_APPROVAL', 'APPROVED')
         ORDER BY b.created_at ASC`,
        [department.id]
      );
      const pendingBookings = await Promise.all(pendingBookingRows.map(async (booking: any) => {
        const customerRows = await db.query('SELECT full_name, email, phone, address FROM users WHERE id = ?', [booking.customer_id]);
        const customer = customerRows[0] || {};
        return { ...booking, customer_name: booking.customer_name || customer.full_name, customer_email: customer.email, customer_phone: booking.customer_phone || customer.phone, service_address: booking.service_address || customer.address };
      }));

      // Active / ongoing bookings
      const activeBookingRows = await db.query(
        `SELECT b.*, u.full_name as customer_name, s.name as service_name,
                wu.full_name as worker_name, w.id as worker_id
         FROM bookings b
         JOIN users u ON b.customer_id = u.id
         JOIN services s ON b.service_id = s.id
         LEFT JOIN workers w ON b.assigned_worker_id = w.id
         LEFT JOIN users wu ON w.user_id = wu.id
         WHERE b.department_id = ? AND b.status IN ('ASSIGNED', 'WORK_STARTED', 'WORK_COMPLETED', 'CUSTOMER_CONFIRMED', 'PAYMENT_PENDING')
         ORDER BY b.created_at DESC`,
        [department.id]
      );
      const activeBookings = await Promise.all(activeBookingRows.map(async (booking: any) => {
        const customerRows = await db.query('SELECT full_name, email, phone, address FROM users WHERE id = ?', [booking.customer_id]);
        const workerRows = booking.assigned_worker_id ? await db.query('SELECT user_id FROM workers WHERE id = ?', [booking.assigned_worker_id]) : [];
        const workerUserRows = workerRows[0] ? await db.query('SELECT full_name FROM users WHERE id = ?', [workerRows[0].user_id]) : [];
        const customer = customerRows[0] || {};
        return { ...booking, customer_name: booking.customer_name || customer.full_name, customer_phone: booking.customer_phone || customer.phone, service_address: booking.service_address || customer.address, worker_name: booking.worker_name || workerUserRows[0]?.full_name };
      }));

      // Workers in department
      const workerRows = await db.query(
        `SELECT w.*, u.full_name, u.email, u.phone, p.profile_photo, p.experience_years
         FROM workers w
         JOIN users u ON w.user_id = u.id
         LEFT JOIN worker_profiles p ON w.id = p.worker_id
         WHERE w.department_id = ?
         ORDER BY w.availability ASC, u.full_name ASC`,
        [department.id]
      );
      // The embedded local database returns the worker record but not joined
      // user fields. Load the linked account and profile explicitly so the
      // Head always sees the technician's name and contact information.
      const workers = await Promise.all(workerRows.map(async (worker: any) => {
        const userRows = await db.query('SELECT full_name, email, phone FROM users WHERE id = ?', [worker.user_id]);
        const profileRows = await db.query('SELECT profile_photo, experience_years FROM worker_profiles WHERE worker_id = ?', [worker.id]);
        return { ...worker, ...(userRows[0] || {}), ...(profileRows[0] || {}) };
      }));

      return res.json({
        success: true,
        data: {
          department,
          pendingBookings,
          activeBookings,
          workers,
          stats: {
            totalWorkers: workers.length,
            availableWorkers: workers.filter((w: any) => w.availability === 'AVAILABLE').length,
            busyWorkers: workers.filter((w: any) => w.availability === 'BUSY').length,
            pendingCount: pendingBookings.length,
            activeCount: activeBookings.length,
          },
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Head: Approve Booking & Assign Worker
   * Head must APPROVE and SELECT an AVAILABLE worker.
   * Race-condition safe transaction.
   */
  static async approveAndAssign(req: AuthRequest, res: Response) {
    const { booking_id } = req.params;
    const { worker_id } = req.body;
    const headUserId = req.user!.id;

    if (!worker_id) {
      return res.status(400).json({
        success: false,
        message: 'A worker must be selected. Automatic selection is not allowed.',
        code: 'WORKER_REQUIRED',
      });
    }

    try {
      const depts = await db.query('SELECT id, name FROM departments WHERE head_user_id = ?', [headUserId]);
      if (depts.length === 0) {
        return res.status(403).json({ success: false, message: 'You are not assigned as Head of any department.', code: 'FORBIDDEN' });
      }
      const department = depts[0];

      const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [booking_id]);
      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }
      const booking = bookings[0];

      if (booking.department_id !== department.id) {
        return res.status(403).json({
          success: false,
          message: 'This booking belongs to another department. A Head cannot manage another department.',
          code: 'FORBIDDEN_DEPARTMENT',
        });
      }

      if (!['PENDING_HEAD_APPROVAL', 'APPROVED'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: `Booking cannot be assigned in status: ${booking.status}.`,
          code: 'INVALID_STATUS',
        });
      }

      // A booking may have only one live dispatch at a time. This prevents
      // several workers from receiving (and accepting) the same job. Once
      // the 10-minute response period has elapsed, mark the old offer as
      // expired so the Head can select another available worker.
      const activeAssignments = await db.query(
        `SELECT id, worker_id, timeout_at
         FROM booking_assignments
         WHERE booking_id = ? AND state = 'PENDING_ACCEPTANCE'
         ORDER BY id DESC LIMIT 1`,
        [booking.id]
      );

      if (activeAssignments.length > 0) {
        const activeAssignment = activeAssignments[0];
        if (new Date(activeAssignment.timeout_at).getTime() > Date.now()) {
          return res.status(409).json({
            success: false,
            message: 'This booking is already awaiting a response from one worker. You can assign another worker only if the offer is declined or the 10-minute response window expires.',
            code: 'ASSIGNMENT_ALREADY_PENDING',
          });
        }

        await db.execute(
          'UPDATE booking_assignments SET state = "EXPIRED" WHERE id = ?',
          [activeAssignment.id]
        );
      }

      // Check worker validity & availability
      const workers = await db.query(
        `SELECT w.*, u.full_name, u.email, u.phone
         FROM workers w
         JOIN users u ON w.user_id = u.id
         WHERE w.id = ? AND w.department_id = ?`,
        [worker_id, department.id]
      );

      if (workers.length === 0) {
        return res.status(400).json({ success: false, message: 'Selected worker does not belong to your department.', code: 'INVALID_WORKER' });
      }

      const worker = workers[0];

      // STRICT RULE: Only AVAILABLE workers can receive new assignments
      if (worker.availability !== 'AVAILABLE' || worker.current_status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          message: `Worker ${worker.full_name} is currently BUSY. You can only assign AVAILABLE workers.`,
          code: 'WORKER_BUSY',
        });
      }

      // Transaction: create assignment with 10-minute timeout window
      await db.transaction(async (trx) => {
        const timeoutAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

        const assignResult = await trx.execute(
          'INSERT INTO booking_assignments (booking_id, worker_id, assigned_by_head_id, state, timeout_at) VALUES (?, ?, ?, ?, ?)',
          [booking.id, worker.id, headUserId, 'PENDING_ACCEPTANCE', timeoutAt]
        );

        // Update booking to APPROVED (waiting for worker acceptance)
        await trx.execute(
          'UPDATE bookings SET status = "APPROVED", assigned_worker_id = ? WHERE id = ?',
          [worker.id, booking.id]
        );

        // Record history
        await trx.execute(
          'INSERT INTO booking_status_history (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [booking.id, 'HEAD_APPROVED_AND_ASSIGNED', headUserId, 'DEPARTMENT_HEAD', booking.status, 'APPROVED', `Head approved and assigned to worker ${worker.full_name} (10-minute response window).`]
        );

        // In-app notification to worker
        await createNotification({
          userId: worker.user_id,
          bookingId: booking.id,
          title: 'New Service Assignment',
          message: `You have an assignment for booking #${booking.booking_number}. You have 10 minutes to respond.`,
          type: 'WORKER_ASSIGNMENT_DISPATCH',
          metadata: { assignmentId: assignResult.insertId, timeoutAt },
        });

        // Email to worker
        await sendWorkerAssignmentEmail(worker.email, worker.full_name, booking.service_name_snapshot, booking.service_address, booking.booking_number);

        // In-app notification to customer
        await createNotification({
          userId: booking.customer_id,
          bookingId: booking.id,
          title: 'Service Request Approved',
          message: `Your booking #${booking.booking_number} was approved by the department head and assigned to ${worker.full_name}.`,
          type: 'HEAD_APPROVED',
        });

        // Broadcast to booking room and worker
        emitBookingUpdate(booking.id, 'HEAD_ASSIGNED', {
          bookingId: booking.id,
          status: 'APPROVED',
          workerName: worker.full_name,
        });

        emitToUser(worker.user_id, 'new_assignment', {
          assignmentId: assignResult.insertId,
          bookingId: booking.id,
          timeoutAt,
        });
      });

      return res.json({
        success: true,
        message: `Booking approved and assigned to ${worker.full_name}. Worker has 10 minutes to respond.`,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Head: Reject booking
   */
  static async rejectBooking(req: AuthRequest, res: Response) {
    const { booking_id } = req.params;
    const { reason } = req.body;
    const headUserId = req.user!.id;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.', code: 'REASON_REQUIRED' });
    }

    try {
      const depts = await db.query('SELECT id FROM departments WHERE head_user_id = ?', [headUserId]);
      if (depts.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized as head', code: 'FORBIDDEN' });
      }

      const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [booking_id]);
      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }
      const booking = bookings[0];

      if (booking.department_id !== depts[0].id) {
        return res.status(403).json({ success: false, message: 'Cannot manage bookings of another department', code: 'FORBIDDEN' });
      }

      await db.transaction(async (trx) => {
        await trx.execute(
          'UPDATE bookings SET status = "REJECTED", cancellation_reason = ? WHERE id = ?',
          [reason.trim(), booking.id]
        );

        await trx.execute(
          'INSERT INTO booking_status_history (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [booking.id, 'HEAD_REJECTED', headUserId, 'DEPARTMENT_HEAD', booking.status, 'REJECTED', reason.trim()]
        );

        await createNotification({
          userId: booking.customer_id,
          bookingId: booking.id,
          title: 'Booking Request Declined',
          message: `Your booking #${booking.booking_number} could not be fulfilled. Reason: ${reason.trim()}`,
          type: 'BOOKING_REJECTED',
        });

        emitBookingUpdate(booking.id, 'BOOKING_REJECTED', {
          bookingId: booking.id,
          status: 'REJECTED',
          reason: reason.trim(),
        });
      });

      return res.json({ success: true, message: 'Booking request rejected.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Head: Create New Worker in their Department
   */
  static async createWorker(req: AuthRequest, res: Response) {
    const headUserId = req.user!.id;
    const { full_name, email, phone, password, address, profile_photo, bio, emergency_phone, experience_years } = req.body;

    if (!full_name || !email || !phone || !password || !address) {
      return res.status(400).json({
        success: false,
        message: 'Full name, email, phone, password, and address are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    try {
      if (!isEmailDeliveryConfigured()) {
        return res.status(503).json({ success: false, message: 'Email delivery must be configured before creating a Worker.', code: 'EMAIL_DELIVERY_UNAVAILABLE' });
      }
      const depts = await db.query('SELECT id, name FROM departments WHERE head_user_id = ?', [headUserId]);
      if (depts.length === 0) {
        return res.status(403).json({ success: false, message: 'You are not assigned as Head of any department.', code: 'FORBIDDEN' });
      }
      const departmentId = depts[0].id;

      const cleanEmail = email.trim().toLowerCase();
      const existing = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
      if (existing.length > 0) {
        return res.status(409).json({ success: false, message: 'An account with this email already exists.', code: 'EMAIL_EXISTS' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const verificationCode = crypto.randomInt(100000, 999999).toString();
      const codeHash = await bcrypt.hash(verificationCode, 10);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      let newWorkerId: number;

      await db.transaction(async (trx) => {
        // 1. Create user with role WORKER
        const userResult = await trx.execute(
          'INSERT INTO users (full_name, email, phone, password_hash, address, role, email_verified, is_active) VALUES (?, ?, ?, ?, ?, "WORKER", 0, 1)',
          [full_name.trim(), cleanEmail, phone.trim(), passwordHash, address.trim()]
        );
        const userId = Number(userResult.insertId);

        await trx.execute(
          'INSERT INTO email_verifications (user_id, email, code_hash, attempts_count, max_attempts, expires_at, is_used) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [userId, cleanEmail, codeHash, 0, 5, expiresAt, 0]
        );
        if (!await sendVerificationEmail(cleanEmail, verificationCode, full_name.trim())) {
          throw new Error('EMAIL_DELIVERY_FAILED');
        }

        // 2. Create worker entry
        const workerResult = await trx.execute(
          'INSERT INTO workers (user_id, department_id, availability, current_status, rating, total_ratings_count, completed_jobs, joining_date) VALUES (?, ?, "AVAILABLE", "AVAILABLE", 5.00, 0, 0, ?)',
          [userId, departmentId, new Date().toISOString().split('T')[0]]
        );
        newWorkerId = Number(workerResult.insertId);

        // 3. Create worker profile (photo uploaded by Head)
        await trx.execute(
          'INSERT INTO worker_profiles (worker_id, profile_photo, bio, emergency_phone, experience_years) VALUES (?, ?, ?, ?, ?)',
          [newWorkerId, profile_photo || null, bio?.trim() || null, emergency_phone?.trim() || null, experience_years || 1]
        );
      });

      return res.status(201).json({
        success: true,
        message: 'Worker created. A verification code was sent to their email.',
        data: { workerId: newWorkerId! },
      });
    } catch (error: any) {
      if (error?.message === 'EMAIL_DELIVERY_FAILED') return res.status(503).json({ success: false, message: 'Verification email could not be sent. The Worker account was not created.', code: 'EMAIL_DELIVERY_FAILED' });
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Head: List all workers in department
   */
  static async listWorkers(req: AuthRequest, res: Response) {
    const headUserId = req.user!.id;

    try {
      const depts = await db.query('SELECT id FROM departments WHERE head_user_id = ?', [headUserId]);
      if (depts.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized as head', code: 'FORBIDDEN' });
      }

      const workers = await db.query(
        `SELECT w.*, u.full_name, u.email, u.phone, u.address, p.profile_photo, p.bio, p.emergency_phone, p.experience_years
         FROM workers w
         JOIN users u ON w.user_id = u.id
         LEFT JOIN worker_profiles p ON w.id = p.worker_id
         WHERE w.department_id = ?
         ORDER BY w.availability ASC, u.full_name ASC`,
        [depts[0].id]
      );

      return res.json({ success: true, data: workers });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Head: View Assignment History for department
   */
  static async getAssignmentHistory(req: AuthRequest, res: Response) {
    const headUserId = req.user!.id;

    try {
      const depts = await db.query('SELECT id FROM departments WHERE head_user_id = ?', [headUserId]);
      if (depts.length === 0) {
        return res.status(403).json({ success: false, message: 'Not authorized as head', code: 'FORBIDDEN' });
      }

      const history = await db.query(
        `SELECT a.*, b.booking_number, b.service_name_snapshot, wu.full_name as worker_name, hu.full_name as head_name
         FROM booking_assignments a
         JOIN bookings b ON a.booking_id = b.id
         JOIN workers w ON a.worker_id = w.id
         JOIN users wu ON w.user_id = wu.id
         JOIN users hu ON a.assigned_by_head_id = hu.id
         WHERE b.department_id = ?
         ORDER BY a.created_at DESC`,
        [depts[0].id]
      );

      return res.json({ success: true, data: history });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }
}
