import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '3306', 10),
  DB_NAME: process.env.DB_NAME || 'workway',
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'workway_super_secure_jwt_token_secret_key_2026_xyz987',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  
  // Mailer Configuration (Nodemailer / Gmail SMTP)
  MAIL_HOST: process.env.MAIL_HOST || 'smtp.gmail.com',
  MAIL_PORT: parseInt(process.env.MAIL_PORT || '587', 10),
  MAIL_SECURE: process.env.MAIL_SECURE === 'true' || process.env.MAIL_PORT === '465',
  MAIL_USER: process.env.MAIL_USER || '',
  MAIL_PASSWORD: process.env.MAIL_PASSWORD || '',
  MAIL_FROM: process.env.MAIL_FROM || 'WORKWAY <support@workway.com>',
  
  // Cashfree Payments
  CASHFREE_APP_ID: process.env.CASHFREE_APP_ID || '',
  CASHFREE_SECRET_KEY: process.env.CASHFREE_SECRET_KEY || '',
  CASHFREE_ENVIRONMENT: (process.env.CASHFREE_ENVIRONMENT || 'sandbox').toLowerCase(),
  CASHFREE_WEBHOOK_SECRET: process.env.CASHFREE_WEBHOOK_SECRET || '',
  
  // URLs
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  APP_URL: process.env.APP_URL || 'http://localhost:3000',

  
};
