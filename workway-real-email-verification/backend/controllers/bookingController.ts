import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { createNotification, notifyDepartmentHead } from '../services/notificationService.js';
import { emitBookingUpdate } from '../services/socketService.js';
import { CashfreeService } from '../services/cashfreeService.js';

export class BookingController {
  /**
   * Customer creates immediate booking
   * Validates: Verified customer, service exists, available workers exist in department.
   */
  static async createBooking(req: AuthRequest, res: Response) {
    const customerId = req.user!.id;
    const { service_id, service_address, customer_phone, description, images } = req.body;

    if (!service_id || !service_address || !customer_phone) {
      return res.status(400).json({
        success: false,
        message: 'Service, service address, and phone number are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    // Image limit: Maximum 5 images
    let validatedImages: string[] = [];
    if (images && Array.isArray(images)) {
      if (images.length > 5) {
        return res.status(400).json({
          success: false,
          message: 'Maximum 5 service images allowed.',
          code: 'IMAGE_LIMIT_EXCEEDED',
        });
      }
      validatedImages = images.slice(0, 5);
    }

    try {
      // 1. Fetch trusted service and department from database
      const services = await db.query(
        `SELECT s.id, s.name, s.fixed_price, s.department_id, d.name as department_name, d.head_user_id
         FROM services s
         JOIN departments d ON s.department_id = d.id
         WHERE s.id = ? AND s.is_active = 1 AND d.is_active = 1`,
        [service_id]
      );

      if (services.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Selected service is currently unavailable or inactive.',
          code: 'SERVICE_NOT_FOUND',
        });
      }

      const service = services[0];

      // 2. CHECK WORKER AVAILABILITY in this department
      // Business rule: If there is no AVAILABLE worker, show "No worker available" and reject booking creation.
      const availableWorkers = await db.query(
        `SELECT id, user_id FROM workers 
         WHERE department_id = ? AND availability = 'AVAILABLE' AND current_status = 'AVAILABLE'`,
        [service.department_id]
      );

      if (availableWorkers.length === 0) {
        return res.status(409).json({
          success: false,
          message: 'No worker available in this department right now. Please try again later.',
          code: 'NO_WORKER_AVAILABLE',
        });
      }

      // 3. Generate unique booking ID and booking number
      const bookingId = crypto.randomUUID();
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = crypto.randomInt(1000, 9999);
      const bookingNumber = `WW-${datePart}-${randomSuffix}`;

      // 4. Create booking in transaction
      await db.transaction(async (trx) => {
        // Insert booking record with trusted service price
        await trx.execute(
          `INSERT INTO bookings 
           (id, booking_number, customer_id, department_id, service_id, service_name_snapshot, service_price, customer_phone, service_address, description, images, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING_HEAD_APPROVAL')`,
          [
            bookingId,
            bookingNumber,
            customerId,
            service.department_id,
            service.id,
            service.name,
            service.fixed_price, // Fixed price from backend DB
            customer_phone.trim(),
            service_address.trim(),
            description?.trim() || null,
            JSON.stringify(validatedImages),
          ]
        );

        // Record history event
        await trx.execute(
          `INSERT INTO booking_status_history 
           (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason)
           VALUES (?, 'BOOKING_CREATED', ?, 'USER', NULL, 'PENDING_HEAD_APPROVAL', 'Customer booked service.')`,
          [bookingId, customerId]
        );

        // Notify customer
        await createNotification({
          userId: customerId,
          bookingId,
          title: 'Booking Request Submitted',
          message: `Your booking #${bookingNumber} for ${service.name} has been placed. Waiting for Department Head approval.`,
          type: 'BOOKING_CREATED',
        });

        // Notify Department Head
        await notifyDepartmentHead(service.department_id, {
          bookingId,
          title: 'New Booking Request',
          message: `New booking request #${bookingNumber} for ${service.name}. ${availableWorkers.length} worker(s) currently available.`,
          type: 'NEW_BOOKING_REQUEST',
          metadata: { bookingId, bookingNumber, serviceName: service.name },
        });

        emitBookingUpdate(bookingId, 'BOOKING_CREATED', {
          bookingId,
          bookingNumber,
          status: 'PENDING_HEAD_APPROVAL',
        });
      });

      return res.status(201).json({
        success: true,
        message: 'Booking request submitted successfully.',
        data: {
          bookingId,
          bookingNumber,
          serviceName: service.name,
          fixedPrice: service.fixed_price,
          status: 'PENDING_HEAD_APPROVAL',
        },
      });
    } catch (error: any) {
      console.error('[Create Booking Error]', error);
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * List Customer's Bookings
   */
  static async getCustomerBookings(req: AuthRequest, res: Response) {
    const customerId = req.user!.id;

    try {
      const bookings = await db.query(
        `SELECT b.*, d.name as department_name, 
                wu.full_name as worker_name, wu.phone as worker_phone, wp.profile_photo as worker_photo,
                p.status as payment_status
         FROM bookings b
         JOIN departments d ON b.department_id = d.id
         LEFT JOIN workers w ON b.assigned_worker_id = w.id
         LEFT JOIN users wu ON w.user_id = wu.id
         LEFT JOIN worker_profiles wp ON w.id = wp.worker_id
         LEFT JOIN payments p ON b.id = p.booking_id AND p.status = 'SUCCESS'
         WHERE b.customer_id = ?
         ORDER BY b.created_at DESC`,
        [customerId]
      );

      return res.json({ success: true, data: bookings });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Get single booking details with full timeline
   */
  static async getBookingDetails(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const user = req.user!;

    try {
      const bookings = await db.query(
        `SELECT b.*, d.name as department_name, d.icon as department_icon,
                cu.full_name as customer_name, cu.email as customer_email,
                wu.full_name as worker_name, wu.phone as worker_phone, wp.profile_photo as worker_photo,
                w.rating as worker_rating
         FROM bookings b
         JOIN departments d ON b.department_id = d.id
         JOIN users cu ON b.customer_id = cu.id
         LEFT JOIN workers w ON b.assigned_worker_id = w.id
         LEFT JOIN users wu ON w.user_id = wu.id
         LEFT JOIN worker_profiles wp ON w.id = wp.worker_id
         WHERE b.id = ?`,
        [id]
      );

      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }

      const booking = bookings[0];

      // Authorization check: User can view their own, Head can view their dept, Worker can view assigned, Admin can view all
      if (user.role === 'USER' && booking.customer_id !== user.id) {
        return res.status(403).json({ success: false, message: 'Access denied', code: 'FORBIDDEN' });
      }
      if (user.role === 'DEPARTMENT_HEAD' && booking.department_id !== user.department_id) {
        return res.status(403).json({ success: false, message: 'Access denied to other departments', code: 'FORBIDDEN' });
      }

      // Timeline events
      const timeline = await db.query(
        `SELECT h.*, u.full_name as actor_name
         FROM booking_status_history h
         LEFT JOIN users u ON h.actor_user_id = u.id
         WHERE h.booking_id = ?
         ORDER BY h.created_at ASC`,
        [id]
      );

      // Feedback if completed
      const feedback = await db.query('SELECT * FROM feedback WHERE booking_id = ?', [id]);

      // Payment records
      const payments = await db.query('SELECT * FROM payments WHERE booking_id = ? ORDER BY created_at DESC', [id]);

      // Cancellation record if cancelled
      const cancellation = await db.query('SELECT * FROM cancellation_records WHERE booking_id = ?', [id]);

      return res.json({
        success: true,
        data: {
          ...booking,
          timeline,
          feedback: feedback.length > 0 ? feedback[0] : null,
          payments,
          cancellation: cancellation.length > 0 ? cancellation[0] : null,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Customer Cancellation
   * Rules:
   * - Before Head approval: Free cancellation.
   * - After worker assignment:
   *    - Within 30 minutes: CANCELLED (Fee: ₹0).
   *    - After 30 minutes: CANCELLED_WITH_FEE (Fee: ₹100, collected via Cashfree).
   * - After work has started: Strictly blocked!
   */
  static async cancelBooking(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;
    const customerId = req.user!.id;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cancellation reason is required.',
        code: 'REASON_REQUIRED',
      });
    }

    try {
      const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }

      const booking = bookings[0];

      if (booking.customer_id !== customerId && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'You can only cancel your own bookings.', code: 'FORBIDDEN' });
      }

      // BLOCK rule: After work has started, cancellation is NOT allowed
      if (['WORK_STARTED', 'WORK_COMPLETED', 'CUSTOMER_CONFIRMED', 'PAYMENT_PENDING', 'PAID', 'COMPLETED'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: 'Cancellation is strictly not permitted once work has started or completed.',
          code: 'CANCELLATION_FORBIDDEN',
        });
      }

      if (['CANCELLED', 'CANCELLED_WITH_FEE', 'REJECTED'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: `Booking is already in terminal state: ${booking.status}.`,
          code: 'ALREADY_CANCELLED',
        });
      }

      const now = new Date();
      let fee = 0;
      let minutesSinceAssignment = 0;
      let targetStatus = 'CANCELLED';

      // Check 30-minute assignment window
      if (booking.assigned_at) {
        const assignedTime = new Date(booking.assigned_at).getTime();
        minutesSinceAssignment = Math.floor((now.getTime() - assignedTime) / (60 * 1000));

        if (minutesSinceAssignment > 30) {
          fee = 100.00;
          targetStatus = 'CANCELLED_WITH_FEE';
        }
      }

      let cashfreeSession: any = null;

      await db.transaction(async (trx) => {
        // If fee applicable, generate Cashfree payment order
        if (fee > 0) {
          const userRows = await trx.query('SELECT full_name, email, phone FROM users WHERE id = ?', [customerId]);
          const user = userRows[0];
          const paymentRef = `CF-FEE-${Date.now()}-${crypto.randomInt(100, 999)}`;

          cashfreeSession = await CashfreeService.createOrder({
            orderId: paymentRef,
            orderAmount: fee,
            customerId: String(customerId),
            customerName: user.full_name,
            customerEmail: user.email,
            customerPhone: user.phone,
          });

          await trx.execute(
            `INSERT INTO payments 
             (payment_reference, booking_id, user_id, payment_type, amount, status, cashfree_order_id, cf_payment_session_id)
             VALUES (?, ?, ?, 'CANCELLATION_FEE', ?, 'PENDING', ?, ?)`,
            [paymentRef, booking.id, customerId, fee, cashfreeSession.orderId, cashfreeSession.paymentSessionId || null]
          );
        }

        // Update booking
        await trx.execute(
          'UPDATE bookings SET status = ?, cancelled_at = ?, cancellation_reason = ?, cancellation_fee = ? WHERE id = ?',
          [targetStatus, now.toISOString(), reason.trim(), fee, booking.id]
        );

        // Record in cancellation_records
        await trx.execute(
          `INSERT INTO cancellation_records (booking_id, cancelled_by_user_id, cancelled_at, reason, minutes_since_assignment, cancellation_fee, fee_paid)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [booking.id, customerId, now.toISOString(), reason.trim(), minutesSinceAssignment, fee, fee === 0 ? 1 : 0]
        );

        // Release worker back to AVAILABLE if assigned
        if (booking.assigned_worker_id) {
          await trx.execute(
            'UPDATE workers SET availability = "AVAILABLE", current_status = "AVAILABLE" WHERE id = ?',
            [booking.assigned_worker_id]
          );
        }

        // Record history
        await trx.execute(
          'INSERT INTO booking_status_history (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            booking.id,
            fee > 0 ? 'CANCELLATION_WITH_FEE' : 'CANCELLATION_FREE',
            customerId,
            'USER',
            booking.status,
            targetStatus,
            `Customer cancelled. Reason: ${reason.trim()}${fee > 0 ? ' (₹100 cancellation fee applies after 30 min window)' : ''}`,
          ]
        );

        // Notify Head
        await notifyDepartmentHead(booking.department_id, {
          bookingId: booking.id,
          title: 'Booking Cancelled by Customer',
          message: `Booking #${booking.booking_number} was cancelled by the customer.`,
          type: 'BOOKING_CANCELLED',
        });

        // Notify Worker if assigned
        if (booking.assigned_worker_id) {
          const w = await trx.query('SELECT user_id FROM workers WHERE id = ?', [booking.assigned_worker_id]);
          if (w.length > 0) {
            await createNotification({
              userId: w[0].user_id,
              bookingId: booking.id,
              title: 'Booking Cancelled',
              message: `Booking #${booking.booking_number} was cancelled by customer. You are now AVAILABLE.`,
              type: 'WORKER_BOOKING_CANCELLED',
            });
          }
        }

        emitBookingUpdate(booking.id, 'BOOKING_CANCELLED', {
          bookingId: booking.id,
          status: targetStatus,
          fee,
        });
      });

      return res.json({
        success: true,
        message: fee > 0
          ? 'Booking cancelled. Since cancellation was requested after 30 minutes of assignment, a ₹100 fee applies.'
          : 'Booking cancelled free of charge.',
        data: {
          status: targetStatus,
          fee,
          payment: cashfreeSession,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Customer Confirms Work Completion
   * WORK_COMPLETED -> CUSTOMER_CONFIRMED -> PAYMENT_PENDING
   */
  static async confirmCompletion(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const customerId = req.user!.id;

    try {
      const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [id]);
      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }

      const booking = bookings[0];

      if (booking.customer_id !== customerId) {
        return res.status(403).json({ success: false, message: 'Access denied', code: 'FORBIDDEN' });
      }

      // Business rule: Customer cannot confirm completion before worker completes!
      if (booking.status !== 'WORK_COMPLETED') {
        return res.status(400).json({
          success: false,
          message: `Cannot confirm completion: Service worker has not completed the work yet (current status: ${booking.status}).`,
          code: 'WORK_NOT_COMPLETED',
        });
      }

      const now = new Date().toISOString();

      await db.transaction(async (trx) => {
        // Transition: WORK_COMPLETED -> CUSTOMER_CONFIRMED -> PAYMENT_PENDING
        await trx.execute(
          'UPDATE bookings SET status = "PAYMENT_PENDING", customer_confirmed_at = ? WHERE id = ?',
          [now, booking.id]
        );

        await trx.execute(
          'INSERT INTO booking_status_history (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [booking.id, 'CUSTOMER_CONFIRMED_COMPLETION', customerId, 'USER', 'WORK_COMPLETED', 'PAYMENT_PENDING', 'Customer confirmed completion. Payment of fixed service price is required.']
        );

        await createNotification({
          userId: customerId,
          bookingId: booking.id,
          title: 'Payment Required',
          message: `Please complete payment of ₹${booking.service_price} for booking #${booking.booking_number}.`,
          type: 'PAYMENT_REQUIRED',
        });

        emitBookingUpdate(booking.id, 'PAYMENT_PENDING', {
          bookingId: booking.id,
          status: 'PAYMENT_PENDING',
          amount: booking.service_price,
        });
      });

      return res.json({
        success: true,
        message: 'Completion confirmed. Please proceed to payment.',
        data: { status: 'PAYMENT_PENDING', amount: booking.service_price },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }
}
