import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { db } from '../database/index.js';

export interface AuthenticatedUser {
  id: number;
  email: string;
  role: 'ADMIN' | 'DEPARTMENT_HEAD' | 'WORKER' | 'USER';
  full_name: string;
  email_verified: boolean;
  department_id?: number;
  worker_id?: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required. Please sign in.',
      code: 'UNAUTHORIZED',
    });
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;
    
    // Fetch fresh user from DB
    const users = await db.query('SELECT id, full_name, email, phone, role, email_verified, is_active FROM users WHERE id = ?', [decoded.id]);
    if (!users || users.length === 0 || !users[0].is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account not found or has been deactivated.',
        code: 'USER_DEACTIVATED',
      });
    }

    const user = users[0];
    let departmentId: number | undefined = undefined;
    let workerId: number | undefined = undefined;

    if (user.role === 'DEPARTMENT_HEAD') {
      const depts = await db.query('SELECT id FROM departments WHERE head_user_id = ?', [user.id]);
      if (depts.length > 0) {
        departmentId = depts[0].id;
      }
    } else if (user.role === 'WORKER') {
      const workers = await db.query('SELECT id, department_id FROM workers WHERE user_id = ?', [user.id]);
      if (workers.length > 0) {
        workerId = workers[0].id;
        departmentId = workers[0].department_id;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      full_name: user.full_name,
      email_verified: Boolean(user.email_verified),
      department_id: departmentId,
      worker_id: workerId,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session. Please sign in again.',
      code: 'INVALID_TOKEN',
    });
  }
}

export function requireRole(...allowedRoles: ('ADMIN' | 'DEPARTMENT_HEAD' | 'WORKER' | 'USER')[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to ${allowedRoles.join(', ')}`,
        code: 'FORBIDDEN_ROLE',
      });
    }

    next();
  };
}

export function requireVerifiedEmail(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
  }

  // Admins are pre-verified, customers must verify email
  if (req.user.role === 'USER' && !req.user.email_verified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required. Please verify your email before booking.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }

  next();
}
