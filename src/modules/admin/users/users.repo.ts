import { query } from '../../../db/pool.js';

export interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'user' | 'admin';
  verified_at: string | null;
  country_id: number | null;
  created_at: Date;
  updated_at: Date;
}

export async function listUsers(limit: number = 50, offset: number = 0): Promise<AdminUser[]> {
  const { rows } = await query<AdminUser>('SELECT id, email, first_name, last_name, role, verified_at, country_id, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]);
  return rows;
}

export async function getUserById(id: string): Promise<AdminUser | null> {
  const { rows } = await query<AdminUser>('SELECT id, email, first_name, last_name, role, verified_at, country_id, created_at, updated_at FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

export async function updateUser(id: string, data: Partial<Omit<AdminUser, 'id' | 'created_at'>>) {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const k of ['first_name', 'last_name', 'role', 'verified_at', 'country_id'] as const) {
    if (data[k] !== undefined) {
      fields.push(`${k} = $${i++}`);
      params.push(data[k]);
    }
  }
  if (!fields.length) return null;
  params.push(id);
  const { rows } = await query<AdminUser>(`UPDATE users SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`, params);
  return rows[0] || null;
}
