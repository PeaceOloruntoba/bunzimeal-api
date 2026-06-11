import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587,
  secure: false, // true for 465, false for other ports
  auth: env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
});

const sendToEmail = env.EMAIL_TO || "peaceoloruntoba22@gmail.com";

export async function sendMail(to: string, subject: string, html: string) {
  if (!env.SMTP_HOST) {
    logger.warn({ to, subject }, 'SMTP not configured; skipping email send');
    return;
  }
  try {
    await transporter.sendMail({ from: env.EMAIL_FROM || 'no-reply@example.com', to, subject, html });
    logger.info({ to, subject }, 'Email sent successfully');
  } catch (err) {
    logger.error({ err, to, subject }, 'Failed to send email');
    throw err;
  }
}