import { db } from '../database/index.js';
import { createNotification, notifyDepartmentHead } from './notificationService.js';
import { emitBookingUpdate } from './socketService.js';

let intervalTimer: NodeJS.Timeout | null = null;

export function startAssignmentTimeoutJob() {
  if (intervalTimer) return;

  intervalTimer = setInterval(async () => {
    try {
      await checkExpiredAssignments();
    } catch (err) {
      console.error('[TimeoutJob] Error checking expired assignments:', err);
    }
  }, 20000); // Check every 20 seconds
}

export async function checkExpiredAssignments() {
  const now = new Date().toISOString();

  // Find assignments in PENDING_ACCEPTANCE where timeout_at <= now
  const expiredAssignments = await db.query(
    `SELECT a.id, a.booking_id, a.worker_id, a.assigned_by_head_id, b.department_id, b.booking_number, w.user_id as worker_user_id
     FROM booking_assignments a
     JOIN bookings b ON a.booking_id = b.id
     JOIN workers w ON a.worker_id = w.id
     WHERE a.state = 'PENDING_ACCEPTANCE' AND a.timeout_at <= ?`,
    [now]
  );

  for (const assignment of expiredAssignments) {
    await db.transaction(async (trx) => {
      // 1. Mark assignment as EXPIRED
      await trx.execute(
        'UPDATE booking_assignments SET state = ?, responded_at = ? WHERE id = ?',
        ['EXPIRED', now, assignment.id]
      );

      // 2. Ensure worker remains AVAILABLE (they hadn't accepted yet)
      await trx.execute(
        'UPDATE workers SET availability = ?, current_status = ? WHERE id = ?',
        ['AVAILABLE', 'AVAILABLE', assignment.worker_id]
      );

      // 3. Clear assigned worker on booking and revert status to APPROVED
      await trx.execute(
        'UPDATE bookings SET status = ?, assigned_worker_id = NULL WHERE id = ?',
        ['APPROVED', assignment.booking_id]
      );

      // 4. Record history
      await trx.execute(
        'INSERT INTO booking_status_history (booking_id, event, actor_role, previous_status, new_status, reason) VALUES (?, ?, ?, ?, ?, ?)',
        [assignment.booking_id, 'ASSIGNMENT_EXPIRED', 'SYSTEM', 'ASSIGNED', 'APPROVED', 'Worker assignment timed out after 10 minutes without response.']
      );

      // 5. Notify worker
      await createNotification({
        userId: assignment.worker_user_id,
        bookingId: assignment.booking_id,
        title: 'Assignment Expired',
        message: `Assignment for booking #${assignment.booking_number} expired due to no response within 10 minutes.`,
        type: 'ASSIGNMENT_EXPIRED',
      });

      // 6. Notify Department Head
      await notifyDepartmentHead(assignment.department_id, {
        bookingId: assignment.booking_id,
        title: 'Worker Assignment Expired',
        message: `Worker did not respond within 10 minutes for booking #${assignment.booking_number}. Please assign another available worker.`,
        type: 'HEAD_ASSIGNMENT_TIMEOUT',
      });

      // 7. Emit live booking update
      emitBookingUpdate(assignment.booking_id, 'ASSIGNMENT_EXPIRED', {
        status: 'APPROVED',
        message: 'Assigned worker timed out. Department head will reassign an available worker.',
      });
    });
  }
}
