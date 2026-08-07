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
  const html = `<p>Your verification code is:</p><h2>${code}</h2><p>This code expires soon.</p>`;
  await sendMail(to, 'Your Verification Code', html);
}

export async function sendResetEmail(to: string, code: string) {
  const html = `<p>Use this code to reset your password:</p><h2>${code}</h2><p>This code expires soon.</p>`;
  await sendMail(to, 'Password Reset', html);
}
