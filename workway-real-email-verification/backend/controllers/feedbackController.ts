import { Response } from 'express';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';

export class FeedbackController {
  /**
   * Submit feedback & 1-5 star rating
   */
  static async submitFeedback(req: AuthRequest, res: Response) {
    const { booking_id, rating, comment } = req.body;
    const customerId = req.user!.id;

    const numRating = parseInt(rating, 10);
    if (!booking_id || isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({
        success: false,
        message: 'A valid rating between 1 and 5 is required.',
        code: 'INVALID_RATING',
      });
    }

    try {
      const bookings = await db.query('SELECT * FROM bookings WHERE id = ?', [booking_id]);
      if (bookings.length === 0) {
        return res.status(404).json({ success: false, message: 'Booking not found', code: 'NOT_FOUND' });
      }

      const booking = bookings[0];

      // Must be customer's own booking
      if (booking.customer_id !== customerId) {
        return res.status(403).json({ success: false, message: 'You can only rate your own completed bookings.', code: 'FORBIDDEN' });
      }

      // Must be COMPLETED
      if (booking.status !== 'COMPLETED') {
        return res.status(400).json({
          success: false,
          message: `Feedback can only be submitted for completed services. Current status: ${booking.status}.`,
          code: 'BOOKING_NOT_COMPLETED',
        });
      }

      if (!booking.assigned_worker_id) {
        return res.status(400).json({ success: false, message: 'No worker was assigned to this booking.', code: 'NO_WORKER' });
      }

      // Check if feedback already submitted
      const existing = await db.query('SELECT id FROM feedback WHERE booking_id = ?', [booking_id]);
      if (existing.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Feedback has already been submitted for this booking.',
          code: 'FEEDBACK_ALREADY_EXISTS',
        });
      }

      await db.transaction(async (trx) => {
        // Insert feedback
        await trx.execute(
          'INSERT INTO feedback (booking_id, customer_id, worker_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
          [booking_id, customerId, booking.assigned_worker_id, numRating, comment?.trim() || null]
        );

        // Recalculate worker's average rating
        const ratings = await trx.query(
          'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM feedback WHERE worker_id = ?',
          [booking.assigned_worker_id]
        );

        const newAvg = Number(ratings[0].avg_rating || 5.0).toFixed(2);
        const totalCount = ratings[0].count || 1;

        await trx.execute(
          'UPDATE workers SET rating = ?, total_ratings_count = ? WHERE id = ?',
          [newAvg, totalCount, booking.assigned_worker_id]
        );
      });

      return res.status(201).json({
        success: true,
        message: 'Thank you! Your feedback has been recorded and worker rating updated.',
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Get feedback for a specific service or worker
   */
  static async getWorkerFeedback(req: AuthRequest, res: Response) {
    const { worker_id } = req.params;

    try {
      const reviews = await db.query(
        `SELECT f.*, u.full_name as customer_name, b.service_name_snapshot
         FROM feedback f
         JOIN users u ON f.customer_id = u.id
         JOIN bookings b ON f.booking_id = b.id
         WHERE f.worker_id = ?
         ORDER BY f.created_at DESC`,
        [worker_id]
      );

      return res.json({ success: true, data: reviews });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }
}
