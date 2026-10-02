import nodemailer, { Transporter } from 'nodemailer';
import { ENV } from '../config/env.js';

let transporter: Transporter | null = null;

if (ENV.MAIL_USER && ENV.MAIL_PASSWORD) {
  transporter = nodemailer.createTransport({
    host: ENV.MAIL_HOST,
    port: ENV.MAIL_PORT,
    secure: ENV.MAIL_SECURE,
    auth: {
      user: ENV.MAIL_USER,
      pass: ENV.MAIL_PASSWORD,
    },
  });
}

/** True only when the server has credentials for a real SMTP provider. */
export function isEmailDeliveryConfigured(): boolean {
  return transporter !== null && Boolean(ENV.MAIL_FROM);
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    console.error('[Mailer] Email delivery is not configured. Set MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD and MAIL_FROM.');
    return false;
  }

  try {
    await transporter.sendMail({
      from: ENV.MAIL_FROM,
      to,
      subject,
      html,
    });
    return true;
  } catch (error) {
    console.error(`[Mailer] Failed sending verification email:`, error);
    return false;
  }
}

export async function sendVerificationEmail(to: string, code: string, name: string): Promise<boolean> {
  const subject = `${code} is your WORKWAY verification code`;
  const html = `
    <div style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #0284c7; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0;">WORKWAY</h1>
        <p style="color: #64748b; font-size: 14px; margin-top: 4px;">Verified Service Marketplace</p>
      </div>
      <p style="font-size: 16px; color: #1e293b;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 15px; color: #475569; line-height: 1.6;">
        Thank you for creating an account with WORKWAY. To complete your registration and activate booking capabilities, please enter the 6-digit verification code below:
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #0f172a; background: #f1f5f9; padding: 14px 28px; border-radius: 8px; border: 1px solid #cbd5e1;">
          ${code}
        </span>
      </div>
      <p style="font-size: 13px; color: #64748b;">
        This code is valid for 15 minutes. For security, do not share this code with anyone. If you did not request this, please disregard this email.
      </p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
      <p style="font-size: 12px; color: #94a3b8; text-align: center;">
        &copy; 2026 WORKWAY Platform. All rights reserved.
      </p>
    </div>
  `;
  return sendEmail(to, subject, html);
}

export async function sendWorkerAssignmentEmail(workerEmail: string, workerName: string, serviceName: string, address: string, bookingNumber: string): Promise<boolean> {
  const subject = `Urgent: New Service Assignment #${bookingNumber}`;
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #0284c7;">WORKWAY Assignment Dispatch</h2>
      <p>Hello <strong>${workerName}</strong>,</p>
      <p>You have been assigned to an immediate service booking by your Department Head.</p>
      <div style="background: #f8fafc; padding: 16px; border-radius: 6px; margin: 16px 0;">
        <p><strong>Booking ID:</strong> ${bookingNumber}</p>
        <p><strong>Service:</strong> ${serviceName}</p>
        <p><strong>Customer Address:</strong> ${address}</p>
      </div>
      <p style="color: #dc2626; font-weight: bold;">
        ⚡ You have 10 MINUTES to respond (Accept or Decline) in your WORKWAY Worker Portal.
      </p>
      <p>Please log in to your dashboard to review details and respond promptly.</p>
    </div>
  `;
  return sendEmail(workerEmail, subject, html);
}
