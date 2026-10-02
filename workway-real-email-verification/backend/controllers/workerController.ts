import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { createNotification, notifyDepartmentHead } from '../services/notificationService.js';
import { emitBookingUpdate } from '../services/socketService.js';

export class WorkerController {
  /**
   * Worker Dashboard overview: Status, pending assignments, active job, stats
   */
  static async getWorkerDashboard(req: AuthRequest, res: Response) {
    const workerUserId = req.user!.id;

    try {
      const workers = await db.query(
        `SELECT w.*, u.full_name, u.email, u.phone, u.address, d.name as department_name, p.profile_photo, p.bio, p.experience_years
         FROM workers w
         JOIN users u ON w.user_id = u.id
         JOIN departments d ON w.department_id = d.id
         LEFT JOIN worker_profiles p ON w.id = p.worker_id
         WHERE w.user_id = ?`,
        [workerUserId]
      );

      if (workers.length === 0) {
        return res.status(404).json({ success: false, message: 'Worker profile not found', code: 'NOT_FOUND' });
      }

      const worker = workers[0];

      // Pending assignments (PENDING_ACCEPTANCE and not timed out)
      const now = new Date().toISOString();
      const pendingAssignmentRows = await db.query(
        `SELECT a.id as assignment_id, a.state, a.timeout_at, a.created_at as assigned_at,
                b.id as booking_id, b.booking_number, b.service_name_snapshot, b.service_price,
                b.customer_phone, b.service_address, b.description, b.images, b.created_at as booked_at,
                u.full_name as customer_name
         FROM booking_assignments a
         JOIN bookings b ON a.booking_id = b.id
         JOIN users u ON b.customer_id = u.id
         WHERE a.worker_id = ? AND a.state = 'PENDING_ACCEPTANCE' AND a.timeout_at > ?
         ORDER BY a.created_at DESC`,
        [worker.id, now]
      );

      // The embedded database returns the base assignment record's `id`
      // instead of the SQL alias `assignment_id`. Normalize it so the
      // Worker dashboard always posts the real assignment ID when accepting
      // or declining a dispatch. MySQL already returns `assignment_id`.
      const pendingAssignments = await Promise.all(pendingAssignmentRows.map(async (assignment: any) => {
        const bookingRows = await db.query('SELECT * FROM bookings WHERE id = ?', [assignment.booking_id]);
        const booking = bookingRows[0] || {};
        const customerRows = booking.customer_id ? await db.query('SELECT full_name, email, phone, address FROM users WHERE id = ?', [booking.customer_id]) : [];
        const customer = customerRows[0] || {};
        return {
          ...assignment,
          assignment_id: assignment.assignment_id ?? assignment.id,
          booking_number: assignment.booking_number || booking.booking_number,
          service_name_snapshot: assignment.service_name_snapshot || booking.service_name_snapshot,
          customer_name: assignment.customer_name || customer.full_name,
          customer_email: customer.email,
          customer_phone: assignment.customer_phone || booking.customer_phone || customer.phone,
          service_address: assignment.service_address || booking.service_address || customer.address,
          description: assignment.description || booking.description,
        };
      }));

      // Active booking (ASSIGNED or WORK_STARTED)
      const activeBookings = await db.query(
        `SELECT b.*, u.full_name as customer_name, u.email as customer_email
         FROM bookings b
         JOIN users u ON b.customer_id = u.id
         WHERE b.assigned_worker_id = ? AND b.status IN ('ASSIGNED', 'WORK_STARTED')
         ORDER BY b.created_at DESC LIMIT 1`,
        [worker.id]
      );

      // Workers never collect payment, but they should be able to see whether
      // the customer still needs to pay after work is completed or whether the
      // payment has been verified successfully.
      const workerBookings = await db.query(
        'SELECT * FROM bookings WHERE assigned_worker_id = ? ORDER BY created_at DESC',
        [worker.id]
      );
      const paymentUpdates = workerBookings
        .filter((booking: any) =>
          ['WORK_COMPLETED', 'CUSTOMER_CONFIRMED', 'PAYMENT_PENDING', 'COMPLETED'].includes(booking.status)
        )
        .slice(0, 5)
        .map((booking: any) => ({
          id: booking.id,
          booking_number: booking.booking_number,
          service_name_snapshot: booking.service_name_snapshot,
          amount: booking.service_price,
          booking_status: booking.status,
          payment_status: booking.status === 'COMPLETED' ? 'PAID' : 'PENDING',
        }));

      const activeBooking = activeBookings.length > 0 ? activeBookings[0] : null;
      if (activeBooking) {
        const customerRows = await db.query('SELECT full_name, email, phone, address FROM users WHERE id = ?', [activeBooking.customer_id]);
        const customer = customerRows[0] || {};
        activeBooking.customer_name = activeBooking.customer_name || customer.full_name;
        activeBooking.customer_email = customer.email;
        activeBooking.customer_phone = activeBooking.customer_phone || customer.phone;
        activeBooking.service_address = activeBooking.service_address || customer.address;
      }

      return res.json({
        success: true,
        data: {
          worker,
          pendingAssignments,
          activeBooking,
          paymentUpdates,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Worker Accept Assignment
   * Assignment: PENDING_ACCEPTANCE -> ACCEPTED
   * Booking: APPROVED -> ASSIGNED
   * Worker: AVAILABLE -> BUSY
   */
  static async acceptAssignment(req: AuthRequest, res: Response) {
    const { assignment_id } = req.params;
    const workerUserId = req.user!.id;

    try {
      // Find worker record
      const workers = await db.query('SELECT id, availability FROM workers WHERE user_id = ?', [workerUserId]);
      if (workers.length === 0) {
        return res.status(403).json({ success: false, message: 'Worker record not found', code: 'FORBIDDEN' });
      }
      const worker = workers[0];

      const assignments = await db.query(
        `SELECT a.*, b.status as booking_status, b.department_id, b.customer_id, b.booking_number
         FROM booking_assignments a
         JOIN bookings b ON a.booking_id = b.id
         WHERE a.id = ? AND a.worker_id = ?`,
        [assignment_id, worker.id]
      );

      if (assignments.length === 0) {
        return res.status(404).json({ success: false, message: 'Assignment not found', code: 'NOT_FOUND' });
      }

      const assignment = assignments[0];

      if (assignment.state !== 'PENDING_ACCEPTANCE') {
        return res.status(400).json({
          success: false,
          message: `Cannot accept assignment: current state is ${assignment.state}.`,
          code: 'INVALID_STATE',
        });
      }

      // Check timeout (10 min)
      if (new Date(assignment.timeout_at).getTime() < Date.now()) {
        await db.execute('UPDATE booking_assignments SET state = "EXPIRED" WHERE id = ?', [assignment.id]);
        return res.status(400).json({
          success: false,
          message: 'Assignment response window (10 minutes) has expired.',
          code: 'ASSIGNMENT_EXPIRED',
        });
      }

      // Perform transaction
      await db.transaction(async (trx) => {
        const now = new Date().toISOString();

        // Update assignment
        await trx.execute(
          'UPDATE booking_assignments SET state = "ACCEPTED", responded_at = ? WHERE id = ?',
          [now, assignment.id]
        );

        // Update booking to ASSIGNED
        await trx.execute(
          'UPDATE bookings SET status = "ASSIGNED", assigned_worker_id = ?, assigned_at = ? WHERE id = ?',
          [worker.id, now, assignment.booking_id]
        );

        // Update worker availability to BUSY
        await trx.execute(
          'UPDATE workers SET availability = "BUSY", current_status = "BUSY" WHERE id = ?',
          [worker.id]
        );

        // Record history
        await trx.execute(
          'INSERT INTO booking_status_history (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [assignment.booking_id, 'WORKER_ACCEPTED', req.user!.id, 'WORKER', 'APPROVED', 'ASSIGNED', 'Worker accepted the assignment.']
        );

        // Notify customer
        await createNotification({
          userId: assignment.customer_id,
          bookingId: assignment.booking_id,
          title: 'Worker Confirmed',
          message: `Worker has accepted your booking #${assignment.booking_number} and will arrive shortly.`,
          type: 'WORKER_ACCEPTED',
        });

        // Notify department head
        await notifyDepartmentHead(assignment.department_id, {
          bookingId: assignment.booking_id,
          title: 'Worker Accepted Assignment',
          message: `Worker has accepted booking #${assignment.booking_number}.`,
          type: 'HEAD_WORKER_ACCEPTED',
        });

        // Live broadcast
        emitBookingUpdate(assignment.booking_id, 'WORKER_ACCEPTED', {
          bookingId: assignment.booking_id,
          status: 'ASSIGNED',
          workerId: worker.id,
        });
      });

      return res.json({ success: true, message: 'Assignment accepted successfully. Worker status marked BUSY.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Worker Decline Assignment
   * Reason is MANDATORY. Do NOT allow empty decline reason.
   */
  static async declineAssignment(req: AuthRequest, res: Response) {
    const { assignment_id } = req.params;
    const { reason } = req.body;
    const workerUserId = req.user!.id;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory decline reason must be provided.',
        code: 'REASON_REQUIRED',
      });
    }

    try {
      const workers = await db.query('SELECT id FROM workers WHERE user_id = ?', [workerUserId]);
      if (workers.length === 0) {
        return res.status(403).json({ success: false, message: 'Worker record not found', code: 'FORBIDDEN' });
      }
      const worker = workers[0];

      const assignments = await db.query(
        `SELECT a.*, b.status as booking_status, b.department_id, b.customer_id, b.booking_number
         FROM booking_assignments a
         JOIN bookings b ON a.booking_id = b.id
         WHERE a.id = ? AND a.worker_id = ?`,
        [assignment_id, worker.id]
      );

      if (assignments.length === 0) {
        return res.status(404).json({ success: false, message: 'Assignment not found', code: 'NOT_FOUND' });
      }

      const assignment = assignments[0];

      if (assignment.state !== 'PENDING_ACCEPTANCE') {
        return res.status(400).json({
          success: false,
          message: `Cannot decline assignment: current state is ${assignment.state}.`,
          code: 'INVALID_STATE',
        });
      }

      await db.transaction(async (trx) => {
        const now = new Date().toISOString();

        // 1. Update assignment to DECLINED with mandatory reason
        await trx.execute(
          'UPDATE booking_assignments SET state = "DECLINED", decline_reason = ?, responded_at = ? WHERE id = ?',
          [reason.trim(), now, assignment.id]
        );

        // 2. Worker remains AVAILABLE
        await trx.execute(
          'UPDATE workers SET availability = "AVAILABLE", current_status = "AVAILABLE" WHERE id = ?',
          [worker.id]
        );

        // 3. Clear assigned worker on booking, return status to APPROVED for Head re-assignment
        await trx.execute(
          'UPDATE bookings SET status = "APPROVED", assigned_worker_id = NULL WHERE id = ?',
          [assignment.booking_id]
        );

        // 4. Record history
        await trx.execute(
          'INSERT INTO booking_status_history (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [assignment.booking_id, 'WORKER_DECLINED', req.user!.id, 'WORKER', 'ASSIGNED', 'APPROVED', `Worker declined: ${reason.trim()}`]
        );

        // 5. Notify Department Head
        await notifyDepartmentHead(assignment.department_id, {
          bookingId: assignment.booking_id,
          title: 'Worker Declined Assignment',
          message: `Worker declined booking #${assignment.booking_number}. Reason: ${reason.trim()}. Please assign another available worker.`,
          type: 'HEAD_WORKER_DECLINED',
        });

        // 6. Notify Customer
        await createNotification({
          userId: assignment.customer_id,
          bookingId: assignment.booking_id,
          title: 'Worker Reassignment in Progress',
          message: 'The assigned worker had a conflict. Our department team is selecting another available worker for you immediately.',
          type: 'WORKER_DECLINED',
        });

        emitBookingUpdate(assignment.booking_id, 'WORKER_DECLINED', {
          bookingId: assignment.booking_id,
          status: 'APPROVED',
          message: 'Worker declined. Head is re-assigning.',
        });
      });

      return res.json({ success: true, message: 'Assignment declined. Department Head notified for re-assignment.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Worker Start Work
   * ASSIGNED -> WORK_STARTED
   */
  static async startWork(req: AuthRequest, res: Response) {
    const { booking_id } = req.params;
    const workerUserId = req.user!.id;

    try {
      const workers = await db.query('SELECT id FROM workers WHERE user_id = ?', [workerUserId]);
      if (workers.length === 0) {
        return res.status(403).json({ success: false, message: 'Worker record not found', code: 'FORBIDDEN' });
      }
      const worker = workers[0];

      const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [booking_id]);
      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }

      const booking = bookings[0];

      if (booking.assigned_worker_id !== worker.id) {
        return res.status(403).json({ success: false, message: 'You are not the assigned worker for this booking.', code: 'FORBIDDEN' });
      }

      if (booking.status !== 'ASSIGNED') {
        return res.status(400).json({
          success: false,
          message: `Cannot start work from current status: ${booking.status}. Work can only be started when ASSIGNED.`,
          code: 'INVALID_STATUS_TRANSITION',
        });
      }

      const now = new Date().toISOString();

      await db.transaction(async (trx) => {
        await trx.execute(
          'UPDATE bookings SET status = "WORK_STARTED", work_started_at = ? WHERE id = ?',
          [now, booking_id]
        );

        await trx.execute(
          'INSERT INTO booking_status_history (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [booking_id, 'WORK_STARTED', req.user!.id, 'WORKER', 'ASSIGNED', 'WORK_STARTED', 'Worker started the service.']
        );

        await createNotification({
          userId: booking.customer_id,
          bookingId: booking.id,
          title: 'Work Started',
          message: `The service worker has arrived and started work on booking #${booking.booking_number}.`,
          type: 'WORK_STARTED',
        });

        emitBookingUpdate(booking_id, 'WORK_STARTED', {
          bookingId: booking.id,
          status: 'WORK_STARTED',
          work_started_at: now,
        });
      });

      return res.json({ success: true, message: 'Work marked as started.', data: { status: 'WORK_STARTED' } });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Worker Complete Work
   * WORK_STARTED -> WORK_COMPLETED
   */
  static async completeWork(req: AuthRequest, res: Response) {
    const { booking_id } = req.params;
    const workerUserId = req.user!.id;

    try {
      const workers = await db.query('SELECT id FROM workers WHERE user_id = ?', [workerUserId]);
      if (workers.length === 0) {
        return res.status(403).json({ success: false, message: 'Worker record not found', code: 'FORBIDDEN' });
      }
      const worker = workers[0];

      const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [booking_id]);
      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }

      const booking = bookings[0];

      if (booking.assigned_worker_id !== worker.id) {
        return res.status(403).json({ success: false, message: 'You are not the assigned worker for this booking.', code: 'FORBIDDEN' });
      }

      if (booking.status !== 'WORK_STARTED') {
        return res.status(400).json({
          success: false,
          message: `Cannot complete work from status: ${booking.status}. Work must be started first.`,
          code: 'INVALID_STATUS_TRANSITION',
        });
      }

      const now = new Date().toISOString();

      await db.transaction(async (trx) => {
        await trx.execute(
          'UPDATE bookings SET status = "WORK_COMPLETED", work_completed_at = ? WHERE id = ?',
          [now, booking_id]
        );

        await trx.execute(
          'INSERT INTO booking_status_history (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [booking_id, 'WORK_COMPLETED', req.user!.id, 'WORKER', 'WORK_STARTED', 'WORK_COMPLETED', 'Worker marked service completed.']
        );

        await createNotification({
          userId: booking.customer_id,
          bookingId: booking.id,
          title: 'Service Completed',
          message: `Service completed for #${booking.booking_number}. Please confirm completion and proceed to payment.`,
          type: 'WORK_COMPLETED',
        });

        emitBookingUpdate(booking_id, 'WORK_COMPLETED', {
          bookingId: booking.id,
          status: 'WORK_COMPLETED',
          work_completed_at: now,
        });
      });

      return res.json({ success: true, message: 'Service marked as completed. Awaiting customer confirmation.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Worker History
   */
  static async getWorkerHistory(req: AuthRequest, res: Response) {
    const workerUserId = req.user!.id;

    try {
      const workers = await db.query('SELECT id FROM workers WHERE user_id = ?', [workerUserId]);
      if (workers.length === 0) {
        return res.status(404).json({ success: false, message: 'Worker not found', code: 'NOT_FOUND' });
      }

      const history = await db.query(
        `SELECT b.*, u.full_name as customer_name, f.rating, f.comment
         FROM bookings b
         JOIN users u ON b.customer_id = u.id
         LEFT JOIN feedback f ON b.id = f.booking_id
         WHERE b.assigned_worker_id = ?
         ORDER BY b.created_at DESC`,
        [workers[0].id]
      );

      return res.json({ success: true, data: history });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }
}
