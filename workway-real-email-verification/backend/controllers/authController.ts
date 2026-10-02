import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../database/index.js';
import { ENV } from '../config/env.js';
import { isEmailDeliveryConfigured, sendVerificationEmail } from '../services/emailService.js';
import { AuthRequest } from '../middleware/auth.js';

export class AuthController {
  /**
   * Customer Registration
   * Role is STRICTLY forced to USER.
   */
  static async register(req: Request, res: Response) {
    const { full_name, email, phone, password, address } = req.body;

    if (!full_name || !email || !phone || !password || !address) {
      return res.status(400).json({
        success: false,
        message: 'All fields (full name, email, phone, password, address) are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!isEmailDeliveryConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Email verification is temporarily unavailable. Please try again later.',
        code: 'EMAIL_DELIVERY_UNAVAILABLE',
      });
    }

    // Check existing email
    const existing = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    // Password validation: minimum 8 characters
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters in length.',
        code: 'WEAK_PASSWORD',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate 6-digit code
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(verificationCode, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' '); // MySQL DATETIME, 15 min expiry

    try {
      const userId = await db.transaction(async (trx) => {
        const userResult = await trx.execute(
          'INSERT INTO users (full_name, email, phone, password_hash, address, role, email_verified, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [full_name.trim(), cleanEmail, phone.trim(), passwordHash, address.trim(), 'USER', 0, 1]
        );
        const newUserId = Number(userResult.insertId);

        await trx.execute(
          'INSERT INTO email_verifications (user_id, email, code_hash, attempts_count, max_attempts, expires_at, is_used) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [newUserId, cleanEmail, codeHash, 0, 5, expiresAt, 0]
        );

        const delivered = await sendVerificationEmail(cleanEmail, verificationCode, full_name.trim());
        if (!delivered) throw new Error('EMAIL_DELIVERY_FAILED');
        return newUserId;
      });

      return res.status(201).json({
        success: true,
        message: 'Account registered successfully. A 6-digit verification code has been sent to your email.',
        data: {
          userId,
          email: cleanEmail,
        },
      });
    } catch (error: any) {
      console.error('[Registration Error]', error);
      if (error?.message === 'EMAIL_DELIVERY_FAILED') {
        return res.status(503).json({
          success: false,
          message: 'We could not send the verification email. No account was created; please try again later.',
          code: 'EMAIL_DELIVERY_FAILED',
        });
      }
      return res.status(500).json({
        success: false,
        message: 'Registration failed. Please try again.',
        code: 'SERVER_ERROR',
      });
    }
  }

  /**
   * Verify Email Code
   */
  static async verifyEmail(req: Request, res: Response) {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and 6-digit verification code are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();

    const verifications = await db.query(
      'SELECT id, user_id, code_hash, attempts_count, max_attempts, expires_at, is_used FROM email_verifications WHERE email = ? AND is_used = 0 ORDER BY id DESC LIMIT 1',
      [cleanEmail]
    );

    if (verifications.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active verification request found for this email. Please request a new code.',
        code: 'NO_ACTIVE_CODE',
      });
    }

    const record = verifications[0];

    // Check expiration
    if (new Date(record.expires_at).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.',
        code: 'CODE_EXPIRED',
      });
    }

    // Check attempts
    if (record.attempts_count >= record.max_attempts) {
      return res.status(429).json({
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new code.',
        code: 'MAX_ATTEMPTS_EXCEEDED',
      });
    }

    // Verify bcrypt hash
    const isMatch = await bcrypt.compare(cleanCode, record.code_hash);
    if (!isMatch) {
      await db.execute('UPDATE email_verifications SET attempts_count = attempts_count + 1 WHERE id = ?', [record.id]);
      const remaining = record.max_attempts - (record.attempts_count + 1);
      return res.status(400).json({
        success: false,
        message: `Invalid verification code. ${remaining} attempts remaining.`,
        code: 'INVALID_CODE',
      });
    }

    // Mark verified in transaction
    await db.transaction(async (trx) => {
      await trx.execute('UPDATE email_verifications SET is_used = 1 WHERE id = ?', [record.id]);
      await trx.execute('UPDATE users SET email_verified = 1 WHERE id = ?', [record.user_id]);
    });

    const userRows = await db.query('SELECT id, full_name, email, phone, role, email_verified FROM users WHERE id = ?', [record.user_id]);
    const user = userRows[0];

    const signOptions: jwt.SignOptions = { expiresIn: (ENV.JWT_EXPIRES_IN || '7d') as any };
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      ENV.JWT_SECRET,
      signOptions
    );

    return res.json({
      success: true,
      message: 'Email successfully verified. Booking capabilities activated.',
      data: {
        token,
        dashboardUrl: ({ ADMIN: '/admin/dashboard', DEPARTMENT_HEAD: '/head/dashboard', WORKER: '/worker/dashboard', USER: '/user/dashboard' } as Record<string, string>)[user.role] || '/user/dashboard',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          email_verified: true,
        },
      },
    });
  }

  /**
   * Resend Verification Code
   */
  static async resendVerification(req: Request, res: Response) {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required', code: 'VALIDATION_ERROR' });
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isEmailDeliveryConfigured()) {
      return res.status(503).json({ success: false, message: 'Email verification is temporarily unavailable. Please try again later.', code: 'EMAIL_DELIVERY_UNAVAILABLE' });
    }
    const users = await db.query('SELECT id, full_name, email_verified FROM users WHERE email = ?', [cleanEmail]);

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Account not found', code: 'NOT_FOUND' });
    }

    if (users[0].email_verified) {
      return res.status(400).json({ success: false, message: 'Email is already verified.', code: 'ALREADY_VERIFIED' });
    }

    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const codeHash = await bcrypt.hash(verificationCode, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    try {
      await db.transaction(async (trx) => {
        await trx.execute('UPDATE email_verifications SET is_used = 1 WHERE user_id = ?', [users[0].id]);
        await trx.execute(
          'INSERT INTO email_verifications (user_id, email, code_hash, attempts_count, max_attempts, expires_at, is_used) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [users[0].id, cleanEmail, codeHash, 0, 5, expiresAt, 0]
        );
        const delivered = await sendVerificationEmail(cleanEmail, verificationCode, users[0].full_name);
        if (!delivered) throw new Error('EMAIL_DELIVERY_FAILED');
      });
    } catch (error: any) {
      if (error?.message === 'EMAIL_DELIVERY_FAILED') {
        return res.status(503).json({ success: false, message: 'We could not send the verification email. Please try again later.', code: 'EMAIL_DELIVERY_FAILED' });
      }
      console.error('[Resend Verification Error]', error);
      return res.status(500).json({ success: false, message: 'Could not create a new verification code. Please try again later.', code: 'SERVER_ERROR' });
    }

    return res.json({
      success: true,
      message: 'A fresh verification code has been sent to your email.',
    });
  }

  /**
   * Login
   * Accepts Email + Password ONLY. Role determined exclusively by backend DB.
   */
  static async login(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const users = await db.query(
      'SELECT id, full_name, email, phone, password_hash, role, email_verified, is_active FROM users WHERE email = ?',
      [cleanEmail]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    const user = users[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'This account has been deactivated. Please contact support.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
        data: { email: user.email },
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }

    let departmentId: number | undefined;
    let workerId: number | undefined;

    if (user.role === 'DEPARTMENT_HEAD') {
      const depts = await db.query('SELECT id, name FROM departments WHERE head_user_id = ?', [user.id]);
      if (depts.length > 0) {
        departmentId = depts[0].id;
      }
    } else if (user.role === 'WORKER') {
      const workers = await db.query('SELECT id, department_id, availability, current_status FROM workers WHERE user_id = ?', [user.id]);
      if (workers.length > 0) {
        workerId = workers[0].id;
        departmentId = workers[0].department_id;
      }
    }

    const signOptions: jwt.SignOptions = { expiresIn: (ENV.JWT_EXPIRES_IN || '7d') as any };
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        department_id: departmentId,
        worker_id: workerId,
      },
      ENV.JWT_SECRET,
      signOptions
    );

    // Dashboard route based strictly on DB role
    const dashboardRoutes: Record<string, string> = {
      ADMIN: '/admin/dashboard',
      DEPARTMENT_HEAD: '/head/dashboard',
      WORKER: '/worker/dashboard',
      USER: '/user/dashboard',
    };

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        token,
        dashboardUrl: dashboardRoutes[user.role] || '/user/dashboard',
        user: {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          email_verified: Boolean(user.email_verified),
          department_id: departmentId,
          worker_id: workerId,
        },
      },
    });
  }

  /**
   * Get Current Authenticated User Profile
   */
  static async getMe(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });
    }

    const userRows = await db.query(
      'SELECT id, full_name, email, phone, address, role, email_verified, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found', code: 'NOT_FOUND' });
    }

    return res.json({
      success: true,
      data: {
        ...userRows[0],
        email_verified: Boolean(userRows[0].email_verified),
        department_id: req.user.department_id,
        worker_id: req.user.worker_id,
      },
    });
  }
}
