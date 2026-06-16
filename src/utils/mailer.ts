import { env, hasBrevo } from '../config/env.js';
import { logger } from '../config/logger.js';

type BrevoRecipient = { email: string; name?: string };

function parseEmailFrom(from: string): BrevoRecipient {
  const match = from.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim().replace(/^"|"$/g, ''), email: match[2].trim() };
  }
  return { email: from.trim() };
}

export async function sendMail(to: string, subject: string, html: string, isTransactional = true) {
  if (!hasBrevo) {
    logger.warn({ to, subject }, 'BREVO_API_KEY not configured; skipping email send');
    return;
  }

  const sender = parseEmailFrom(env.EMAIL_FROM || 'BunziMeal <no-reply@bunzimeal.com>');
  const headers: Record<string, string> = isTransactional
    ? { 'X-Priority': '1', Precedence: 'auto' }
    : { Precedence: 'bulk' };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': env.BREVO_API_KEY!,
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      headers,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    logger.error({ to, subject, status: response.status, detail }, 'Brevo email send failed');
    throw new Error(`Brevo email failed (${response.status})`);
  }

  logger.info({ to, subject }, 'Email sent via Brevo');
}

export async function sendOtpEmail(to: string, code: string) {
  const html = `<p>Your verification code is:</p><h2>${code}</h2><p>This code expires soon.</p>`;
  await sendMail(to, 'Your Verification Code', html);
}

export async function sendResetEmail(to: string, code: string) {
  const html = `<p>Use this code to reset your password:</p><h2>${code}</h2><p>This code expires soon.</p>`;
  await sendMail(to, 'Password Reset', html);
}
