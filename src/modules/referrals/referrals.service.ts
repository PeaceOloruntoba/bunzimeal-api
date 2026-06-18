import { logger } from '../../config/logger.js';
import * as repo from './referrals.repo.js';
import * as billingRepo from '../billing/billing.repo.js';
import type { UserSubscription } from '../billing/billing.repo.js';
import { query } from '../../db/pool.js';

export type RedemptionCheck =
  | { ok: true; affiliate: repo.Affiliate }
  | { error: 'invalid' | 'inactive' | 'window' | 'capacity' | 'already_redeemed' };

export async function canRedeem(userId: string, code: string): Promise<RedemptionCheck> {
  const affiliate = await repo.getAffiliateByCode(code);
  if (!affiliate) return { error: 'invalid' };
  if (!affiliate.active) return { error: 'inactive' };
  
  const now = new Date();
  if (affiliate.starts_at && new Date(affiliate.starts_at) > now) return { error: 'window' };
  if (affiliate.ends_at && new Date(affiliate.ends_at) < now) return { error: 'window' };
  
  const count = await repo.getRedemptionCount(affiliate.id);
  if (count >= affiliate.cap) return { error: 'capacity' };
  
  const already = await repo.hasUserRedeemed(userId);
  if (already) return { error: 'already_redeemed' };
  
  return { ok: true, affiliate };
}

export async function redeem(userId: string, code: string) {
  const check = await canRedeem(userId, code);
  if ('error' in check) return check;
  
  const affiliate = check.affiliate;
  const redemption = await repo.createRedemption(userId, affiliate.id, code, affiliate.benefit, affiliate.benefit_value);
  if (!redemption) return { error: 'already_redeemed' as const };
  
  await query('UPDATE users SET referred_by_affiliate = $1 WHERE id = $2', [affiliate.id, userId]);
  return { ok: true as const, affiliate, redemption };
}

export async function markApplied(userId: string) {
  await repo.markRedemptionApplied(userId);
  // Check affiliate rewards thresholds
  const { rows: rr } = await query<{ affiliate_id: string }>('SELECT affiliate_id FROM referral_redemptions WHERE user_id = $1', [userId]);
  const affiliateId = rr[0]?.affiliate_id;
  if (!affiliateId) return;
  
  const appliedCount = await repo.getAppliedRedemptionCount(affiliateId);
  const affiliate = await repo.getAffiliateByCode('dummy'); // We need to get it by id
  // Let's get affiliate by id
  const { rows: affRows } = await query<repo.Affiliate>('SELECT * FROM affiliates WHERE id = $1', [affiliateId]);
  const aff = affRows[0];
  if (!aff) return;
  
  const earnedCredits = Math.floor(appliedCount / 100);
  const toAward = Math.max(0, earnedCredits - aff.rewards_awarded);
  
  if (toAward > 0 && aff.owner_user_id) {
    // Grant free months
    const { rows: subs } = await query<UserSubscription>('SELECT * FROM user_subscriptions WHERE user_id = $1', [aff.owner_user_id]);
    if (subs[0]) {
      const subId = subs[0].id;
      await query(
        `UPDATE user_subscriptions SET status = 'active', current_period_end = COALESCE(current_period_end, NOW()) + ($1 * interval '1 month'), updated_at = NOW() WHERE id = $2`,
        [toAward, subId]
      );
    } else {
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + toAward);
      await query(
        `INSERT INTO user_subscriptions(user_id, plan, status, current_period_start, current_period_end, amount_cents, currency, auto_renew, created_at, updated_at)
         VALUES($1,'monthly','active',$2,$3,0,'NGN',true,NOW(),NOW())`,
        [aff.owner_user_id, now.toISOString(), end.toISOString()]
      );
    }
    await repo.updateAffiliateRewardsAwarded(affiliateId, toAward);
    logger.info({ affiliateId, toAward, ownerUserId: aff.owner_user_id }, 'Affiliate rewards awarded');
  }
}

export async function getAffiliateByCode(code: string) {
  return await repo.getAffiliateByCode(code);
}

export async function getUserReferralStatus(userId: string) {
  const request = await repo.getAffiliateRequest(userId);
  const affiliate = await repo.getAffiliateByOwner(userId);
  return {
    request: request,
    affiliate: affiliate,
    code: affiliate?.code || null
  };
}

export async function getUserReferralStats(userId: string) {
  const affiliate = await repo.getAffiliateByOwner(userId);
  if (!affiliate) return { total: 0, applied: 0, code: null };
  
  const total = await repo.getRedemptionCount(affiliate.id);
  const applied = await repo.getAppliedRedemptionCount(affiliate.id);
  return { total, applied, code: affiliate.code };
}
