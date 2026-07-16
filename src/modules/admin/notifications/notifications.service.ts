import { logger } from '../../../config/logger.js';
import { sendMail } from '../../../utils/mailer.js';
import { query } from '../../../db/pool.js';
import * as repo from './notifications.repo.js';

async function sendNewsletterEmail(to: string, subject: string, html: string) {
  await sendMail(to, subject, html);
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface Recipient {
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
}

function renderTemplate(
  template: string,
  user: Recipient
) {
  const localPart = (user.email && user.email.split('@')[0]) || '';
  const firstNameRaw = (user.first_name || '').trim();
  const lastNameRaw = (user.last_name || '').trim();
  const fullNameRaw = (user.name || '').trim();

  const firstNameFallback =
    firstNameRaw || (fullNameRaw ? fullNameRaw.split(' ')[0] : '') || localPart || 'there';
  const lastNameFallback =
    lastNameRaw || (fullNameRaw ? fullNameRaw.split(' ').slice(1).join(' ') : '') || '';
  const fullNameFallback =
    fullNameRaw || [firstNameRaw, lastNameRaw].filter(Boolean).join(' ').trim() || localPart || '';

  return template
    .replace(/\{\{\s*firstName\s*\}\}/gi, escapeHtml(firstNameFallback))
    .replace(/\{\{\s*first_name\s*\}\}/gi, escapeHtml(firstNameFallback))
    .replace(/\{\{\s*fullName\s*\}\}/gi, escapeHtml(fullNameFallback))
    .replace(/\{\{\s*displayName\s*\}\}/gi, escapeHtml(fullNameFallback))
    .replace(/\{\{\s*display_name\s*\}\}/gi, escapeHtml(fullNameFallback))
    .replace(/\{\{\s*lastName\s*\}\}/gi, escapeHtml(lastNameFallback))
    .replace(/\{\{\s*last_name\s*\}\}/gi, escapeHtml(lastNameFallback))
    .replace(/\{\{\s*email\s*\}\}/gi, escapeHtml(user.email || ''));
}

export async function createAndSendAsync(input: {
  title: string;
  body_html: string;
  is_admin_only?: boolean;
  exclude_user_ids?: string[];
}) {
  const { title, body_html, is_admin_only = false, exclude_user_ids = [] } = input;
  const newsletterId = await repo.createNewsletter(title, body_html, is_admin_only);
  const recipients = await repo.getRecipients(exclude_user_ids, is_admin_only) as Recipient[];

  if (recipients[0]) {
    try {
      const r = recipients[0];
      const personalizedHtml = renderTemplate(body_html, r);
      await sendNewsletterEmail(r.email, title, personalizedHtml);
    } catch (err) {
      logger.error({ err, to: recipients[0].email, newsletterId }, 'Failed to send first newsletter email');
    }
  }

  setImmediate(async () => {
    try {
      for (let i = 1; i < recipients.length; i++) {
        const r = recipients[i];
        try {
          const personalizedHtml = renderTemplate(body_html, r);
          await sendNewsletterEmail(r.email, title, personalizedHtml);
        } catch (err) {
          logger.error({ err, to: r.email, newsletterId }, 'Failed to send newsletter email (background)');
        }
      }
      logger.info({ newsletterId, total: recipients.length }, 'Newsletter background send completed');
    } catch (err) {
      logger.error({ err, newsletterId }, 'Newsletter background send crashed');
    }
  });

  return { id: newsletterId, recipients: recipients.length, accepted: true } as const;
}

export async function renderPreview(body_html: string, user_id?: string) {
  let user: Recipient = { email: 'user@example.com', first_name: 'John', last_name: 'Doe', name: 'John Doe' };

  if (user_id) {
    const { rows } = await query<Recipient>(
      'SELECT email, first_name, last_name, name FROM users WHERE id=$1 LIMIT 1',
      [user_id]
    );
    if (rows.length) user = rows[0];
  }

  return renderTemplate(body_html, user);
}

export async function listNewsletters(limit = 50) {
  return repo.listNewsletters(limit);
}

export async function getNewsletterById(id: string) {
  return repo.getNewsletterById(id);
}
