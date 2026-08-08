import { query } from '../../db/pool.js';

export interface BillingPlan {
  id: number;
  country_id: number;
  currency: string;
  price: number;
  price_cents: number;
  price_monthly_cents: number;
  price_quarterly_cents: number;
  price_biannual_cents: number;
  price_annual_cents: number;
  created_at: Date;
  updated_at: Date;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan: 'monthly' | 'quarterly' | 'biannual' | 'annual';
  status: 'none' | 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired';
  trial_end: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  amount_cents: number;
  currency: string;
  auto_renew: boolean;
  referral_code: string | null;
  affiliate_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Payment {
  id: string;
  user_id: string;
  reference: string | null;
  gateway_payment_id: string | null;
  amount_cents: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata: any | null;
  failure_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function getBillingPlanByCountry(countryId: number): Promise<BillingPlan | null> {
  const { rows } = await query<BillingPlan>('SELECT * FROM billing_plans WHERE country_id = $1', [countryId]);
  return rows[0] || null;
}

export async function listBillingPlansWithCountry(): Promise<(BillingPlan & { country_name: string; country_code: string })[]> {
  const { rows } = await query<BillingPlan & { country_name: string; country_code: string }>(
    `SELECT bp.*, c.name AS country_name, c.code AS country_code
     FROM billing_plans bp
     JOIN countries c ON c.id = bp.country_id
     ORDER BY c.name ASC`
  );
  return rows;
}

export async function upsertBillingPlan(countryId: number, currency: string, priceWhole: number, derived: { price_cents: number; price_monthly_cents: number; price_quarterly_cents: number; price_biannual_cents: number; price_annual_cents: number; }) {
  const { price_cents, price_monthly_cents, price_quarterly_cents, price_biannual_cents, price_annual_cents } = derived;
  const { rows } = await query<BillingPlan>(
    `INSERT INTO billing_plans(country_id, currency, price, price_cents, price_monthly_cents, price_quarterly_cents, price_biannual_cents, price_annual_cents, created_at, updated_at)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
     ON CONFLICT (country_id) DO UPDATE SET
       currency = EXCLUDED.currency, price = EXCLUDED.price, price_cents = EXCLUDED.price_cents,
       price_monthly_cents = EXCLUDED.price_monthly_cents, price_quarterly_cents = EXCLUDED.price_quarterly_cents,
       price_biannual_cents = EXCLUDED.price_biannual_cents, price_annual_cents = EXCLUDED.price_annual_cents,
       updated_at = NOW()
     RETURNING *`,
    [countryId, currency, priceWhole, price_cents, price_monthly_cents, price_quarterly_cents, price_biannual_cents, price_annual_cents]
  );
  return rows[0];
}

export async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  const { rows } = await query<UserSubscription>('SELECT * FROM user_subscriptions WHERE user_id = $1', [userId]);
  return rows[0] || null;
}

export async function markSubscriptionExpired(userId: string): Promise<UserSubscription | null> {
  const { rows } = await query<UserSubscription>(
    `UPDATE user_subscriptions
     SET status = 'expired'::subscription_status, auto_renew = false, updated_at = NOW()
     WHERE user_id = $1 AND status IN ('active'::subscription_status, 'trialing'::subscription_status)
       AND COALESCE(current_period_end, trial_end) IS NOT NULL
       AND COALESCE(current_period_end, trial_end) <= NOW()
     RETURNING *`,
    [userId]
  );
  return rows[0] || null;
}

export async function createOrUpdateUserSubscription(userId: string, data: Partial<Omit<UserSubscription, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) {
  const { rows } = await query<UserSubscription>(
    `INSERT INTO user_subscriptions(user_id, plan, status, trial_end, current_period_start, current_period_end, amount_cents, currency, auto_renew, referral_code, affiliate_id, created_at, updated_at)
    VALUES($1,COALESCE($2,'monthly')::subscription_plan,COALESCE($3,'expired')::subscription_status,$4,$5,$6,COALESCE($7,0),COALESCE($8,'USD'),false,$10,$11,NOW(),NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       plan = CASE WHEN $2 IS NOT NULL THEN EXCLUDED.plan ELSE user_subscriptions.plan END,
       status = CASE WHEN $3 IS NOT NULL THEN EXCLUDED.status ELSE user_subscriptions.status END,
       trial_end = CASE WHEN $4 IS NOT NULL THEN EXCLUDED.trial_end ELSE user_subscriptions.trial_end END,
       current_period_start = CASE WHEN $5 IS NOT NULL THEN EXCLUDED.current_period_start ELSE user_subscriptions.current_period_start END,
       current_period_end = CASE WHEN $6 IS NOT NULL THEN EXCLUDED.current_period_end ELSE user_subscriptions.current_period_end END,
       amount_cents = CASE WHEN $7 IS NOT NULL THEN EXCLUDED.amount_cents ELSE user_subscriptions.amount_cents END,
       currency = CASE WHEN $8 IS NOT NULL THEN EXCLUDED.currency ELSE user_subscriptions.currency END,
      auto_renew = false,
       referral_code = CASE WHEN $10 IS NOT NULL THEN EXCLUDED.referral_code ELSE user_subscriptions.referral_code END,
       affiliate_id = CASE WHEN $11 IS NOT NULL THEN EXCLUDED.affiliate_id ELSE user_subscriptions.affiliate_id END,
       updated_at = NOW()
     RETURNING *`,
    [userId, data.plan, data.status, data.trial_end, data.current_period_start, data.current_period_end, data.amount_cents, data.currency, data.auto_renew, data.referral_code, data.affiliate_id]
  );
  return rows[0];
}

export async function claimExpiryNotification(subscriptionId: string, milestoneDays: number): Promise<boolean> {
  const { rows } = await query(
    `INSERT INTO subscription_expiry_notifications(subscription_id, milestone_days)
     VALUES($1, $2) ON CONFLICT (subscription_id, milestone_days) DO NOTHING
     RETURNING id`,
    [subscriptionId, milestoneDays]
  );
  return rows.length === 1;
}

export async function createPayment(userId: string, data: { amount_cents: number; currency: string; metadata?: any }) {
  const { rows } = await query<Payment>(
    `INSERT INTO payments(user_id, amount_cents, currency, status, metadata, created_at, updated_at)
     VALUES($1,$2,$3,'pending',$4,NOW(),NOW())
     RETURNING *`,
    [userId, data.amount_cents, data.currency, data.metadata ?? null]
  );
  return rows[0];
}

export async function updatePayment(paymentId: string, data: Partial<Omit<Payment, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) {
  const fields: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const k of ['reference', 'gateway_payment_id', 'status', 'metadata', 'failure_message'] as const) {
    if (data[k] !== undefined) {
      fields.push(`${k} = $${i++}`);
      params.push(data[k]);
    }
  }
  if (!fields.length) return;
  params.push(paymentId);
  await query(`UPDATE payments SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i}`, params);
}

export async function getPayment(paymentId: string): Promise<Payment | null> {
  const { rows } = await query<Payment>('SELECT * FROM payments WHERE id = $1', [paymentId]);
  return rows[0] || null;
}

export async function getPaymentByReference(reference: string): Promise<Payment | null> {
  const { rows } = await query<Payment>('SELECT * FROM payments WHERE reference = $1', [reference]);
  return rows[0] || null;
}
