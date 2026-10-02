import { Request, Response } from 'express';
import crypto from 'crypto';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';
import { CashfreeService } from '../services/cashfreeService.js';
import { createNotification, notifyDepartmentHead } from '../services/notificationService.js';
import { emitBookingUpdate } from '../services/socketService.js';

export class PaymentController {
  /**
   * Create Cashfree Order for Booking or Cancellation Fee
   * TRUSTED AMOUNT RULE: Amount strictly derived from database booking.service_price or cancellation fee.
   */
  static async createPaymentSession(req: AuthRequest, res: Response) {
    const { booking_id, payment_type = 'SERVICE_CHARGE' } = req.body;
    const customerId = req.user!.id;

    try {
      const bookings = await db.query(
        `SELECT b.*, u.full_name, u.email, u.phone 
         FROM bookings b
         JOIN users u ON b.customer_id = u.id
         WHERE b.id = ?`,
        [booking_id]
      );

      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }

      const booking = bookings[0];

      if (booking.customer_id !== customerId && req.user!.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Unauthorized payment attempt', code: 'FORBIDDEN' });
      }

      let payableAmount = 0;

      if (payment_type === 'SERVICE_CHARGE') {
        if (!['PAYMENT_PENDING', 'CUSTOMER_CONFIRMED'].includes(booking.status)) {
          return res.status(400).json({
            success: false,
            message: `Service payment can only be initiated when service is confirmed and payment is pending. Current status: ${booking.status}.`,
            code: 'INVALID_STATUS',
          });
        }
        payableAmount = Number(booking.service_price);
      } else if (payment_type === 'CANCELLATION_FEE') {
        if (booking.status !== 'CANCELLED_WITH_FEE') {
          return res.status(400).json({
            success: false,
            message: 'Cancellation fee is not applicable for this booking.',
            code: 'INVALID_STATUS',
          });
        }
        payableAmount = Number(booking.cancellation_fee || 100.00);
      }

      if (payableAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Payable amount must be greater than zero.', code: 'INVALID_AMOUNT' });
      }

      // Generate unique payment reference
      const paymentRef = `WW-PAY-${Date.now()}-${crypto.randomInt(1000, 9999)}`;

      // Create Cashfree Order
      const cfOrder = await CashfreeService.createOrder({
        orderId: paymentRef,
        orderAmount: payableAmount,
        customerId: String(customerId),
        customerName: booking.customer_name || booking.full_name || req.user!.full_name,
        customerEmail: booking.customer_email || booking.email || req.user!.email,
        customerPhone: booking.customer_phone || booking.phone || '9876543210',
      });

      // Insert payment record in DB
      await db.execute(
        `INSERT INTO payments 
         (payment_reference, booking_id, user_id, payment_type, amount, currency, cashfree_order_id, cf_payment_session_id, status)
         VALUES (?, ?, ?, ?, ?, 'INR', ?, ?, 'PENDING')`,
        [paymentRef, booking.id, customerId, payment_type, payableAmount, cfOrder.orderId, cfOrder.paymentSessionId || null]
      );

      return res.json({
        success: true,
        message: 'Payment session created successfully.',
        data: {
          paymentReference: paymentRef,
          orderId: cfOrder.orderId,
          amount: payableAmount,
          currency: 'INR',
          paymentSessionId: cfOrder.paymentSessionId,
          paymentUrl: cfOrder.paymentUrl,
        },
      });
    } catch (error: any) {
      console.error('[Payment Order Error]', error);
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Cashfree Webhook Handler
   * Validates signature, verifies idempotent processing, updates payment & booking status
   */
  static async handleWebhook(req: Request, res: Response) {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const rawBody = JSON.stringify(req.body);

    if (signature && timestamp) {
      const isValid = CashfreeService.verifyWebhookSignature(signature, rawBody, timestamp);
      if (!isValid) {
        console.warn('[Cashfree Webhook] Invalid webhook signature detected');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const { data } = req.body;
    const orderId = data?.order?.order_id || req.body.order_id;
    const paymentStatus = data?.payment?.payment_status || req.body.payment_status;
    const paymentMethod = data?.payment?.payment_group || 'upi';

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID missing' });
    }

    try {
      const payments = await db.query('SELECT * FROM payments WHERE cashfree_order_id = ? OR payment_reference = ?', [orderId, orderId]);
      if (payments.length === 0) {
        return res.status(404).json({ success: false, message: 'Payment record not found' });
      }

      const payment = payments[0];

      // Idempotency: If already SUCCESS, ignore duplicate
      if (payment.status === 'SUCCESS') {
        return res.json({ success: true, message: 'Payment already processed' });
      }

      if (paymentStatus === 'SUCCESS') {
        await PaymentController.markPaymentSuccess(payment, paymentMethod, data);
      } else if (['FAILED', 'USER_DROPPED', 'CANCELLED'].includes(paymentStatus)) {
        await db.execute('UPDATE payments SET status = "FAILED", cf_response_data = ? WHERE id = ?', [JSON.stringify(req.body), payment.id]);
      }

      return res.json({ success: true, message: 'Webhook processed' });
    } catch (error: any) {
      console.error('[Cashfree Webhook Error]', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Verify and confirm payment manually / on return from Cashfree checkout
   */
  static async verifyPayment(req: AuthRequest, res: Response) {
    const { order_id } = req.params;

    try {
      const payments = await db.query(
        'SELECT * FROM payments WHERE cashfree_order_id = ? OR payment_reference = ?',
        [order_id, order_id]
      );

      if (payments.length === 0) {
        return res.status(404).json({ success: false, message: 'Payment record not found', code: 'NOT_FOUND' });
      }

      const payment = payments[0];

      if (payment.status === 'SUCCESS') {
        return res.json({ success: true, message: 'Payment verified successfully.', data: { status: 'SUCCESS' } });
      }

      // Check with Cashfree API
      const cfOrder = await CashfreeService.getOrder(payment.cashfree_order_id || payment.payment_reference);

      if (cfOrder.order_status === 'PAID') {
        await PaymentController.markPaymentSuccess(payment, 'upi', cfOrder);
        return res.json({ success: true, message: 'Payment verified and confirmed.', data: { status: 'SUCCESS' } });
      } else {
        return res.json({ success: false, message: 'Payment is still pending or failed.', data: { status: cfOrder.order_status } });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Helper: Execute complete success workflow in transaction
   */
  private static async markPaymentSuccess(payment: any, paymentMethod: string, rawData: any) {
    const now = new Date().toISOString();

    await db.transaction(async (trx) => {
      // 1. Update payment status to SUCCESS
      await trx.execute(
        `UPDATE payments 
         SET status = 'SUCCESS', payment_method = ?, paid_at = ?, cf_response_data = ?
         WHERE id = ?`,
        [paymentMethod, now, JSON.stringify(rawData), payment.id]
      );

      const bookings = await trx.query('SELECT * FROM bookings WHERE id = ?', [payment.booking_id]);
      if (bookings.length === 0) return;
      const booking = bookings[0];

      if (payment.payment_type === 'SERVICE_CHARGE') {
        // Transition: PAYMENT_PENDING -> PAID -> COMPLETED
        await trx.execute(
          'UPDATE bookings SET status = "COMPLETED" WHERE id = ?',
          [booking.id]
        );

        // RELEASE WORKER: BUSY -> AVAILABLE, increment completed_jobs
        if (booking.assigned_worker_id) {
          await trx.execute(
            `UPDATE workers 
             SET availability = 'AVAILABLE', current_status = 'AVAILABLE', completed_jobs = completed_jobs + 1 
             WHERE id = ?`,
            [booking.assigned_worker_id]
          );
        }

        // Record history
        await trx.execute(
          `INSERT INTO booking_status_history 
           (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason)
           VALUES (?, 'PAYMENT_SUCCESS', ?, 'USER', 'PAYMENT_PENDING', 'COMPLETED', ?)`,
          [booking.id, payment.user_id, `Payment of ₹${payment.amount} verified via Cashfree (${paymentMethod}). Booking completed.`]
        );

        // Notifications
        await createNotification({
          userId: booking.customer_id,
          bookingId: booking.id,
          title: 'Payment Confirmed & Service Completed',
          message: `Your payment of ₹${payment.amount} was verified. Thank you for choosing WORKWAY! Please leave feedback.`,
          type: 'PAYMENT_SUCCESS',
        });

        if (booking.assigned_worker_id) {
          const w = await trx.query('SELECT user_id FROM workers WHERE id = ?', [booking.assigned_worker_id]);
          if (w.length > 0) {
            await createNotification({
              userId: w[0].user_id,
              bookingId: booking.id,
              title: 'Job Completed & Payment Received',
              message: `Booking #${booking.booking_number} is completed. You are now AVAILABLE for new assignments.`,
              type: 'WORKER_JOB_COMPLETED',
            });
          }
        }

        emitBookingUpdate(booking.id, 'PAYMENT_SUCCESS', {
          bookingId: booking.id,
          status: 'COMPLETED',
          paymentStatus: 'SUCCESS',
        });
      } else if (payment.payment_type === 'CANCELLATION_FEE') {
        // Update cancellation_records
        await trx.execute(
          'UPDATE cancellation_records SET fee_paid = 1, fee_payment_id = ? WHERE booking_id = ?',
          [payment.id, booking.id]
        );

        await trx.execute(
          `INSERT INTO booking_status_history 
           (booking_id, event, actor_user_id, actor_role, previous_status, new_status, reason)
           VALUES (?, 'CANCELLATION_FEE_PAID', ?, 'USER', 'CANCELLED_WITH_FEE', 'CANCELLED_WITH_FEE', ?)`,
          [booking.id, payment.user_id, `Cancellation fee of ₹${payment.amount} paid via Cashfree.`]
        );

        emitBookingUpdate(booking.id, 'CANCELLATION_FEE_PAID', {
          bookingId: booking.id,
          status: 'CANCELLED_WITH_FEE',
          feePaid: true,
        });
      }
    });
  }
}
