import { query } from '../../../db/pool.js';

export interface Affiliate {
  id: string;
  name: string;
  code: string;
  benefit: 'percent_discount' | 'trial_days';
  benefit_value: number;
  cap: number;
  active: boolean;
  starts_at: Date | null;
  ends_at: Date | null;
  rewards_awarded: number;
  owner_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function listAffiliates() {
  const { rows } = await query<Affiliate>('SELECT * FROM affiliates ORDER BY created_at DESC');
  return rows;
}

export async function createAffiliate(data: Omit<Affiliate, 'id' | 'rewards_awarded' | 'created_at' | 'updated_at'>) {
  const { name, code, benefit, benefit_value, cap, active, starts_at, ends_at, owner_user_id } = data;
  const { rows } = await query<Affiliate>(
    `INSERT INTO affiliates(name, code, benefit, benefit_value, cap, active, starts_at, ends_at, owner_user_id, created_at, updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
     RETURNING *`,
    [name, code, benefit, benefit_value, cap, active, starts_at, ends_at, owner_user_id]
  );
  return rows[0];
}

export async function updateAffiliate(id: string, data: Partial<Omit<Affiliate, 'id' | 'created_at' | 'rewards_awarded'>>) {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) {
      fields.push(`${k} = $${i++}`);
      params.push(v);
    }
  }
  if (!fields.length) return null;
  fields.push('updated_at = NOW()');
  params.push(id);
  const { rows } = await query<Affiliate>(`UPDATE affiliates SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, params);
  return rows[0] || null;
}

export async function deleteAffiliate(id: string) {
  await query('DELETE FROM affiliates WHERE id=$1', [id]);
}

export async function getAffiliateByCode(code: string) {
  const { rows } = await query<Affiliate>('SELECT * FROM affiliates WHERE LOWER(code) = LOWER($1)', [code]);
  return rows[0] || null;
}

