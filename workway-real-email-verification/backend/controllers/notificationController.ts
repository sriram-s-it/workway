import { Response } from 'express';
import { db } from '../database/index.js';
import { AuthRequest } from '../middleware/auth.js';

export class NotificationController {
  /**
   * Get notifications for authenticated user
   */
  static async getNotifications(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    try {
      const notifications = await db.query(
        'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
        [userId]
      );

      const unreadCount = await db.query(
        'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
        [userId]
      );

      return res.json({
        success: true,
        data: {
          notifications,
          unreadCount: unreadCount[0]?.count || 0,
        },
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Mark single notification as read
   */
  static async markAsRead(req: AuthRequest, res: Response) {
    const { id } = req.params;
    const userId = req.user!.id;

    try {
      await db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, userId]);
      return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }

  /**
   * Mark all as read
   */
  static async markAllAsRead(req: AuthRequest, res: Response) {
    const userId = req.user!.id;

    try {
      await db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
      return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message, code: 'SERVER_ERROR' });
    }
  }
}
