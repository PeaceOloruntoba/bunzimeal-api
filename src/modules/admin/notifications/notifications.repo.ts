import { query } from '../../../db/pool.js';

export interface Newsletter {
  id: string;
  title: string;
  body_html: string;
  is_admin_only: boolean;
  created_at: Date;
}

export async function createNewsletter(title: string, body_html: string, is_admin_only: boolean) {
  const { rows } = await query<{ id: string }>(
    'INSERT INTO newsletters(title, body_html, is_admin_only) VALUES($1,$2,$3) RETURNING id',
    [title, body_html, is_admin_only]
  );
  return rows[0].id;
}

export async function listNewsletters(limit = 50) {
  const { rows } = await query<Newsletter>(
    'SELECT id, title, created_at, is_admin_only FROM newsletters ORDER BY created_at DESC LIMIT $1',
    [limit]
  );
  return rows;
}

export async function getNewsletterById(id: string) {
  const { rows } = await query<Newsletter>(
    'SELECT id, title, body_html, is_admin_only, created_at FROM newsletters WHERE id=$1',
    [id]
  );
  return rows[0] || null;
}

export async function getRecipients(exclude_user_ids: string[], is_admin_only: boolean) {
  let sql = `
    SELECT id, email, first_name, last_name, name
    FROM users
    WHERE deleted_at IS NULL
    AND verified_at IS NOT NULL
  `;
  const params: any[] = [];
  if (exclude_user_ids.length) {
    const placeholders = exclude_user_ids.map((_id, i) => `$${i + 1}`).join(',');
    sql += ` AND id NOT IN (${placeholders})`;
    params.push(...exclude_user_ids);
  }
  if (is_admin_only) {
    sql += ' AND role = $' + (params.length + 1);
    params.push('admin');
  }
  const { rows } = await query(sql, params);
  return rows;
}

