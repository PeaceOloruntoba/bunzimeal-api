import { createTransport, Transporter } from 'nodemailer';
import { env, hasResend, hasSmtp, hasEmail } from '../config/env.js';
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

function getSmtpTransporter(): Transporter {
  if (smtpTransporter) return smtpTransporter;

  const port = env.SMTP_PORT ?? 465;
  const secure = env.SMTP_SECURE ?? port === 465;

  smtpTransporter = createTransport({
    host: env.SMTP_HOST!,
    port,
    secure,
    auth: {
      user: env.SMTP_USER!,
      pass: env.SMTP_PASSWORD!,
    },
  });

  return smtpTransporter;
}

export async function sendMail(to: string, subject: string, html: string) {
  if (!hasEmail) {
    logger.warn({ to, subject }, 'No email provider configured (SMTP or Resend); skipping email send');
    return;
  }

  const sender = parseEmailFrom(env.EMAIL_FROM || 'BunziMeal <bunzimealpleanner@gmail.com>');
  const from = sender.name ? `${sender.name} <${sender.email}>` : sender.email;

  if (hasSmtp) {
    try {
      const transporter = getSmtpTransporter();
      const info = await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      logger.info({ to, subject, messageId: info.messageId }, 'Email sent via SMTP');
      return;
    } catch (e: any) {
      logger.error({ to, subject, err: e?.message }, 'SMTP email send failed');
      if (!hasResend) {
        throw new Error(`SMTP email failed: ${e?.message ?? e}`);
      }
      logger.warn({ to, subject }, 'Falling back to Resend REST API');
    }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Bearer ${env.RESEND_API_KEY!}`,
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    logger.error({ to, subject, status: response.status, detail }, 'Resend email send failed');
    throw new Error(`Resend email failed (${response.status})`);
  }

  logger.info({ to, subject }, 'Email sent via Resend');
}

export async function sendOtpEmail(to: string, code: string) {
  const html = `<p>Your verification code is:</p><h2>${code}</h2><p>This code expires soon.</p>`;
  await sendMail(to, 'Your Verification Code', html);
}

export async function sendResetEmail(to: string, code: string) {
  const html = `<p>Use this code to reset your password:</p><h2>${code}</h2><p>This code expires soon.</p>`;
  await sendMail(to, 'Password Reset', html);
}
