import { query } from '../../../db/pool.js';

export interface SiteContents {
  id: string;
  privacy_policy: string;
  terms_and_condition: string;
  refund_policy: string;
  created_at: Date;
  updated_at: Date;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export async function getContents() {
  const { rows } = await query<SiteContents>('SELECT * FROM site_contents LIMIT 1');
  return rows[0] || null;
}

export async function updateContents(fields: {
  privacy_policy?: string;
  terms_and_condition?: string;
  refund_policy?: string;
}) {
  const { privacy_policy, terms_and_condition, refund_policy } = fields;
  const existing = await getContents();
  if (!existing) {
    const { rows } = await query<SiteContents>(
      'INSERT INTO site_contents(privacy_policy, terms_and_condition, refund_policy, created_at, updated_at) VALUES($1,$2,$3,NOW(),NOW()) RETURNING *',
      [privacy_policy || '', terms_and_condition || '', refund_policy || '']
    );
    return rows[0];
  }
  const { rows } = await query<SiteContents>(
    'UPDATE site_contents SET privacy_policy=COALESCE($1,privacy_policy), terms_and_condition=COALESCE($2,terms_and_condition), refund_policy=COALESCE($3,refund_policy), updated_at=NOW() RETURNING *',
    [privacy_policy, terms_and_condition, refund_policy]
  );
  return rows[0];
}

export async function adminListFaqs() {
  const { rows } = await query<Faq>('SELECT * FROM faqs ORDER BY created_at DESC');
  return rows;
}

export async function createFaq(question: string, answer: string) {
  const { rows } = await query<Faq>('INSERT INTO faqs(question, answer, created_at, updated_at) VALUES($1,$2,NOW(),NOW()) RETURNING *', [question, answer]);
  return rows[0];
}

export async function updateFaq(id: string, question: string, answer: string) {
  const { rows } = await query<Faq>('UPDATE faqs SET question=$1, answer=$2, updated_at=NOW() WHERE id=$3 RETURNING *', [question, answer, id]);
  return rows[0];
}

export async function softDeleteFaq(id: string) {
  await query('UPDATE faqs SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1', [id]);
}

export async function listPublicFaqs() {
  const { rows } = await query<Faq>('SELECT id, question, answer, created_at, updated_at FROM faqs WHERE deleted_at IS NULL ORDER BY created_at DESC');
  return rows;
}

