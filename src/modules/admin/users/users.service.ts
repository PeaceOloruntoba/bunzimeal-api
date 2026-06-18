import { query } from '../../../db/pool.js';
import * as repo from './users.repo.js';

export async function listUsers(limit: number, offset: number, search?: string) {
  let sql = `
    SELECT id, email, first_name, last_name, role, verified_at, country_id, created_at, updated_at
    FROM users
    WHERE deleted_at IS NULL
  `;
  const params: any[] = [];
  let i = 1;
  if (search) {
    sql += ` AND (email ILIKE $${i++} OR first_name ILIKE $${i++} OR last_name ILIKE $${i++})`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }
  sql += ` ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`;
  params.push(limit, offset);
  const { rows } = await query(sql, params);
  return rows;
}

export async function getUserById(id: string) {
  return repo.getUserById(id);
}

export async function updateUser(id: string, data: { first_name?: string; last_name?: string; role?: 'user' | 'admin'; country_id?: number; }) {
  return repo.updateUser(id, data);
}

