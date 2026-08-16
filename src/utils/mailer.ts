import { createTransport, Transporter } from 'nodemailer';
import { env, hasSmtp, hasEmail } from '../config/env.js';
import { logger } from '../config/logger.js';

type ResendRecipient = { email: string; name?: string };

function parseEmailFrom(from: string): ResendRecipient {
  const match = from.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  }
  return { email: from.trim() };
}

let smtpTransporter: Transporter | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function getSmtpTransporter(): Transporter {
  if (smtpTransporter) return smtpTransporter;

  const port = Number(env.SMTP_PORT) || 587;
  const secure = port === 465;

  smtpTransporter = createTransport({
    host: env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure,
    requireTLS: true,
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000,
    auth: {
      user: env.SMTP_USER!,
      pass: env.SMTP_PASSWORD!,
    },
  });

  logger.info({ host: env.SMTP_HOST || 'smtp.gmail.com', port, secure }, 'Configured SMTP transport');

  return smtpTransporter;
}

export async function sendMail(to: string, subject: string, html: string) {
  const sender = parseEmailFrom(env.EMAIL_FROM || 'BunziMeal <bunzimealpleanner@gmail.com>');
  const from = sender.name ? `"${sender.name}" <${sender.email}>` : sender.email;

  logger.info({ to, subject, from, hasSmtp }, 'Attempting to send Gmail SMTP email');

  if (!hasEmail && !env.SMTP_USER) {
    const error = new Error('No email provider configured. Please set up SMTP env variables.');
    logger.error({ to, subject, from }, 'Email send failed: SMTP credentials missing');
    throw error;
  }

  try {
    const transporter = getSmtpTransporter();
    logger.info({ to, subject, from, smtpHost: env.SMTP_HOST || 'smtp.gmail.com', smtpPort: Number(env.SMTP_PORT) || 587, smtpSecure: Number(env.SMTP_PORT) === 465 }, 'Sending email via Gmail SMTP');

    const info = await withTimeout(
      transporter.sendMail({
        from,
        to,
        subject,
        html,
      }),
      30000,
      'Gmail SMTP send timed out after 30s'
    );

    logger.info({ to, subject, from, messageId: info.messageId }, 'Email successfully sent via Gmail SMTP');
    return;
  } catch (e: any) {
    logger.error({ to, subject, from, err: e?.message, stack: e?.stack }, 'Gmail SMTP email send failed');
    throw new Error(`Gmail SMTP email failed: ${e?.message ?? e}`);
  }
}

export async function sendOtpEmail(to: string, code: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Verify Your Email</h2>
      <p style="color: #666;">Thank you for signing up for BunziMeal. Please use the verification code below to activate your account:</p>
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <h1 style="color: #333; font-size: 32px; margin: 0;">${code}</h1>
      </div>
      <p style="color: #666;">This code will expire in 10 minutes. If you didn't request this verification, please ignore this email.</p>
      <p style="color: #999; font-size: 12px;">© ${new Date().getFullYear()} BunziMeal. All rights reserved.</p>
    </div>
  `;
  await sendMail(to, 'Verify Your BunziMeal Account', html);
}

export async function sendResetEmail(to: string, code: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p style="color: #666;">We received a request to reset your password for your BunziMeal account. Use the code below to set a new password:</p>
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <h1 style="color: #333; font-size: 32px; margin: 0;">${code}</h1>
      </div>
      <p style="color: #666;">This code will expire in 10 minutes. If you didn't request this password reset, please ignore this email.</p>
      <p style="color: #999; font-size: 12px;">© ${new Date().getFullYear()} BunziMeal. All rights reserved.</p>
    </div>
  `;
  await sendMail(to, 'Reset Your BunziMeal Password', html);
}

export async function sendMigrationOtpEmail(to: string, code: string) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Welcome to BunziMeal - Account Migration</h2>
      <p style="color: #666;">We're migrating your account to our new system. To complete the migration and set up your new password, please use the verification code below:</p>
      <div style="background: #f5f5f5; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <h1 style="color: #333; font-size: 32px; margin: 0;">${code}</h1>
      </div>
      <p style="color: #666;">This code will expire in 10 minutes. After verifying this code, you'll be able to set a new password for your account.</p>
      <p style="color: #666;">If you didn't request this migration, please contact our support team immediately.</p>
      <p style="color: #999; font-size: 12px;">© ${new Date().getFullYear()} BunziMeal. All rights reserved.</p>
    </div>
  `;
  await sendMail(to, 'Complete Your BunziMeal Account Migration', html);
}
