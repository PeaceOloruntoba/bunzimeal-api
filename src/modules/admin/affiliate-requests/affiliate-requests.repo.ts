import { query } from '../../../db/pool.js';
import * as affiliatesRepo from '../affiliates/affiliates.repo.js';

export interface AffiliateRequest {
  id: string;
  user_id: string;
  pitch: string | null;
  social_links: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

function genCode7() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 7; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function ensureUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = genCode7();
    const exists = await affiliatesRepo.getAffiliateByCode(candidate);
    if (!exists) return candidate;
  }
  throw new Error('Failed to generate unique code');
}

export async function listAffiliateRequests() {
  const { rows } = await query<AffiliateRequest & { email: string }>(
    `SELECT ar.*, u.email FROM affiliate_requests ar JOIN users u ON u.id = ar.user_id ORDER BY ar.created_at DESC`
  );
  return rows;
}

export async function approveRequest(id: string) {
  const { rows: existing } = await query<AffiliateRequest>('SELECT * FROM affiliate_requests WHERE id=$1', [id]);
  if (!existing.length) return null;
  if (existing[0].status === 'approved') throw new Error('Already approved');

  const code = await ensureUniqueCode();
  const aff = await query<affiliatesRepo.Affiliate>(
    `INSERT INTO affiliates(name, code, benefit, benefit_value, cap, active, owner_user_id, created_at, updated_at)
     VALUES($1,$2,'percent_discount',50,100,true,$3,NOW(),NOW())
     RETURNING *`,
    [existing[0].pitch || 'Affiliate', code, existing[0].user_id]
  );
  await query('UPDATE affiliate_requests SET status=$1, updated_at=NOW() WHERE id=$2', ['approved', id]);
  return { affiliate: aff.rows[0], code };
}

export async function rejectRequest(id: string) {
  const { rows: existing } = await query('SELECT * FROM affiliate_requests WHERE id=$1', [id]);
  if (!existing.length) return null;
  await query('UPDATE affiliate_requests SET status=$1, updated_at=NOW() WHERE id=$2', ['rejected', id]);
  return { ok: true };
}

