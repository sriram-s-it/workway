import { db } from '../database/index.js';
import { emitToUser, emitToDepartment } from './socketService.js';

export async function createNotification(params: {
  userId: number;
  bookingId?: string;
  title: string;
  message: string;
  type: string;
  metadata?: any;
}) {
  const { userId, bookingId, title, message, type, metadata } = params;

  try {
    const result = await db.execute(
      'INSERT INTO notifications (user_id, booking_id, title, message, type, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, bookingId || null, title, message, type, metadata ? JSON.stringify(metadata) : null]
    );

    const newNotification = {
      id: result.insertId,
      user_id: userId,
      booking_id: bookingId,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date().toISOString(),
    };

    emitToUser(userId, 'notification', newNotification);
    return newNotification;
  } catch (error) {
    console.error('[Notification] Error creating notification:', error);
    return null;
  }
}

export async function notifyDepartmentHead(departmentId: number, params: {
  bookingId?: string;
  title: string;
  message: string;
  type: string;
  metadata?: any;
}) {
  try {
    const depts = await db.query('SELECT head_user_id FROM departments WHERE id = ?', [departmentId]);
    if (depts.length > 0 && depts[0].head_user_id) {
      await createNotification({
        userId: depts[0].head_user_id,
        ...params,
      });
    }
    emitToDepartment(departmentId, 'head_alert', params);
  } catch (error) {
    console.error('[Notification] Error notifying head:', error);
  }
}
