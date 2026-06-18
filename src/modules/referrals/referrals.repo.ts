import { query } from '../../db/pool.js';

export interface Affiliate {
  id: string;
  name: string;
  code: string;
  benefit: 'percent_discount' | 'trial_days';
  benefit_value: number;
  cap: number;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  rewards_awarded: number;
  owner_user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ReferralRedemption {
  id: string;
  user_id: string;
  affiliate_id: string;
  code: string;
  benefit: 'percent_discount' | 'trial_days';
  benefit_value: number;
  applied: boolean;
  metadata: any;
  created_at: Date;
}

export interface AffiliateRequest {
  id: string;
  user_id: string;
  pitch: string | null;
  social_links: string[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: Date;
  updated_at: Date;
}

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  const { rows } = await query<Affiliate>('SELECT * FROM affiliates WHERE LOWER(code) = LOWER($1)', [code]);
  return rows[0] || null;
}

export async function getRedemptionCount(affiliateId: string): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::int AS count FROM referral_redemptions WHERE affiliate_id = $1', [affiliateId]);
  return Number(rows[0]?.count || 0);
}

export async function hasUserRedeemed(userId: string): Promise<boolean> {
  const { rows } = await query<{ id: string }>('SELECT id FROM referral_redemptions WHERE user_id = $1', [userId]);
  return !!rows[0];
}

export async function createRedemption(userId: string, affiliateId: string, code: string, benefit: 'percent_discount' | 'trial_days', benefitValue: number) {
  const { rows } = await query<ReferralRedemption>(
    `INSERT INTO referral_redemptions(user_id, affiliate_id, code, benefit, benefit_value, applied, metadata, created_at)
     VALUES($1,$2,$3,$4,$5,false,'{}',NOW())
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId, affiliateId, code, benefit, benefitValue]
  );
  return rows[0] || null;
}

export async function markRedemptionApplied(userId: string) {
  await query('UPDATE referral_redemptions SET applied = true WHERE user_id = $1', [userId]);
}

export async function updateAffiliateRewardsAwarded(affiliateId: string, amount: number) {
  await query('UPDATE affiliates SET rewards_awarded = rewards_awarded + $1, updated_at = NOW() WHERE id = $2', [amount, affiliateId]);
}

export async function listAffiliates(): Promise<Affiliate[]> {
  const { rows } = await query<Affiliate>('SELECT * FROM affiliates ORDER BY created_at DESC');
  return rows;
}

export async function createAffiliate(data: Omit<Affiliate, 'id' | 'rewards_awarded' | 'created_at' | 'updated_at'>) {
  const { rows } = await query<Affiliate>(
    `INSERT INTO affiliates(name, code, benefit, benefit_value, cap, active, starts_at, ends_at, owner_user_id, created_at, updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
     RETURNING *`,
    [data.name, data.code, data.benefit, data.benefit_value, data.cap, data.active, data.starts_at, data.ends_at, data.owner_user_id]
  );
  return rows[0];
}

export async function updateAffiliate(id: string, data: Partial<Omit<Affiliate, 'id' | 'created_at'>>) {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const k of ['name', 'code', 'benefit', 'benefit_value', 'cap', 'active', 'starts_at', 'ends_at', 'owner_user_id'] as const) {
    if (data[k] !== undefined) {
      fields.push(`${k} = $${i++}`);
      params.push(data[k]);
    }
  }
  if (!fields.length) return null;
  params.push(id);
  const { rows } = await query<Affiliate>(`UPDATE affiliates SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`, params);
  return rows[0] || null;
}

export async function deleteAffiliate(id: string) {
  await query('DELETE FROM affiliates WHERE id = $1', [id]);
}

export async function getAffiliateRequest(userId: string): Promise<AffiliateRequest | null> {
  const { rows } = await query<AffiliateRequest>('SELECT * FROM affiliate_requests WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

export async function createAffiliateRequest(userId: string, pitch: string | null, socialLinks: string[]) {
  const { rows } = await query<AffiliateRequest>(
    `INSERT INTO affiliate_requests(user_id, pitch, social_links, status, created_at, updated_at)
     VALUES($1,$2,$3,'pending',NOW(),NOW())
     RETURNING *`,
    [userId, pitch, socialLinks]
  );
  return rows[0];
}

export async function listAffiliateRequests(): Promise<AffiliateRequest[]> {
  const { rows } = await query<AffiliateRequest>('SELECT * FROM affiliate_requests ORDER BY created_at DESC');
  return rows;
}

export async function updateAffiliateRequest(id: string, status: 'pending' | 'approved' | 'rejected') {
  const { rows } = await query<AffiliateRequest>(
    'UPDATE affiliate_requests SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
    [status, id]
  );
  return rows[0] || null;
}

export async function getAffiliateByOwner(userId: string): Promise<Affiliate | null> {
  const { rows } = await query<Affiliate>('SELECT * FROM affiliates WHERE owner_user_id = $1', [userId]);
  return rows[0] || null;
}

export async function getAppliedRedemptionCount(affiliateId: string): Promise<number> {
  const { rows } = await query<{ count: string }>('SELECT COUNT(*)::int AS count FROM referral_redemptions WHERE affiliate_id = $1 AND applied = true', [affiliateId]);
  return Number(rows[0]?.count || 0);
}
