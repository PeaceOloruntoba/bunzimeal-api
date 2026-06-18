import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query } from '../../db/pool.js';

export interface RefreshToken {
  id: string;
  selector: string;
  token_hash: string;
  user_id: string;
  user_agent?: string;
  ip_address?: string;
  created_at: Date;
  last_used_at?: Date;
  expires_at: Date;
  revoked: boolean;
}

export interface OtpCode {
  id: string;
  user_id?: string;
  otp_hash: string;
  purpose: string;
  created_at: Date;
  expires_at: Date;
  used: boolean;
  ip_address?: string;
  attempts: number;
}

export interface Affiliate {
  id: string;
  name: string;
  code: string;
  benefit: 'percent_discount' | 'trial_days';
  benefit_value: number;
  cap: number;
  active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}

function genSelector(len = 12): string {
  return crypto.randomBytes(len).toString('hex');
}

function genValidator(len = 48): string {
  return crypto.randomBytes(len).toString('base64url');
}

export async function createUser(email: string, passwordHash: string, firstName: string, lastName: string, countryId: number) {
  const { rows } = await query<{ id: string }>(
    'INSERT INTO users(email, password_hash, first_name, last_name, country_id) VALUES($1,$2,$3,$4,$5) RETURNING id',
    [email, passwordHash, firstName, lastName, countryId]
  );
  return rows[0];
}

export async function getUserByEmail(email: string) {
  const { rows } = await query<{ id: string; password_hash: string; verified_at: string | null; token_version: number; first_name: string | null; last_name: string | null; role: 'user' | 'admin'; country_id: number | null }>(
    'SELECT id, password_hash, verified_at, token_version, first_name, last_name, role, country_id FROM users WHERE email=$1',
    [email]
  );
  return rows[0];
}

export async function getUserById(id: string) {
  const { rows } = await query<{ id: string; email: string; token_version: number; first_name: string | null; last_name: string | null; role: 'user' | 'admin' }>(
    'SELECT id, email, token_version, first_name, last_name, role FROM users WHERE id=$1',
    [id]
  );
  return rows[0];
}

export async function verifyUser(id: string) {
  await query('UPDATE users SET verified_at=NOW() WHERE id=$1', [id]);
}

export async function updateUserPassword(id: string, passwordHash: string) {
  await query('UPDATE users SET password_hash=$1 WHERE id=$2', [passwordHash, id]);
}

export async function incrementTokenVersion(id: string) {
  await query('UPDATE users SET token_version = token_version + 1 WHERE id=$1', [id]);
}

export async function createRefreshToken(userId: string, options?: { userAgent?: string | null; ipAddress?: string | null }) {
  const selector = genSelector();
  const validator = genValidator();
  const rawToken = `${selector}.${validator}`;
  const hash = await bcrypt.hash(validator, 12);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  
  await query(
    'INSERT INTO refresh_tokens(selector, token_hash, user_id, expires_at, user_agent, ip_address, created_at, last_used_at) VALUES($1,$2,$3,$4,$5,$6,NOW(),NOW())',
    [selector, hash, userId, expiresAt, options?.userAgent || null, options?.ipAddress || null]
  );
  
  return { token: rawToken, expiresAt };
}

export async function getRefreshTokenBySelector(selector: string) {
  const { rows } = await query<RefreshToken>(
    'SELECT * FROM refresh_tokens WHERE selector=$1 AND revoked=false LIMIT 1',
    [selector]
  );
  return rows[0];
}

export async function revokeRefreshTokenBySelector(selector: string) {
  await query('UPDATE refresh_tokens SET revoked=true WHERE selector=$1', [selector]);
}

export async function revokeAllRefreshTokensForUser(userId: string) {
  await query('UPDATE refresh_tokens SET revoked=true WHERE user_id=$1', [userId]);
}

export async function issueOtp(userId: string | null, purpose: string, ipAddress: string | null) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const hash = await bcrypt.hash(code, 12);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  
  await query(
    'INSERT INTO otp_codes(user_id, otp_hash, purpose, expires_at, ip_address) VALUES($1,$2,$3,$4,$5)',
    [userId, hash, purpose, expiresAt, ipAddress]
  );
  
  return code;
}

export async function getUnusedOtpsForUser(userId: string, purpose: string) {
  const { rows } = await query<OtpCode>(
    'SELECT * FROM otp_codes WHERE user_id = $1 AND purpose=$2 AND used=false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 3',
    [userId, purpose]
  );
  return rows;
}

export async function markOtpAsUsed(id: string) {
  await query('UPDATE otp_codes SET used=true WHERE id=$1', [id]);
}

export async function incrementOtpAttempts(id: string) {
  await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id=$1', [id]);
}

export async function getCountryById(countryId: number) {
  const { rows } = await query<{ id: number; name: string; code: string; currency: string }>(
    'SELECT * FROM countries WHERE id=$1',
    [countryId]
  );
  return rows[0] || null;
}

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  const { rows } = await query<Affiliate>('SELECT * FROM affiliates WHERE LOWER(code)=LOWER($1)', [code]);
  return rows[0] || null;
}

export async function getRedemptionCount(affiliateId: string) {
  const { rows } = await query<{ count: number }>('SELECT COUNT(*)::int AS count FROM referral_redemptions WHERE affiliate_id=$1', [affiliateId]);
  return rows[0]?.count ?? 0;
}

export async function hasUserRedeemed(userId: string) {
  const { rows } = await query<{ id: string }>('SELECT id FROM referral_redemptions WHERE user_id=$1', [userId]);
  return !!rows[0];
}

export async function createReferralRedemption(userId: string, affiliateId: string, code: string, benefit: string, benefitValue: number) {
  const { rows } = await query(
    `INSERT INTO referral_redemptions(user_id, affiliate_id, code, benefit, benefit_value, applied, metadata, created_at)
     VALUES($1,$2,$3,$4,$5,false,'{}',NOW())
     ON CONFLICT (user_id) DO NOTHING
     RETURNING *`,
    [userId, affiliateId, code, benefit, benefitValue]
  );
  return rows[0];
}

export async function setUserReferredByAffiliate(userId: string, affiliateId: string) {
  await query('UPDATE users SET referred_by_affiliate=$1 WHERE id=$2', [affiliateId, userId]);
}

export async function createProfile(userId: string) {
  await query('INSERT INTO profiles(user_id) VALUES($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
}

export async function createUserSubscription(userId: string, referralCode: string | null = null, affiliateId: string | null = null) {
  const trialDays = 14;
  await query(
    'INSERT INTO user_subscriptions(user_id, plan, status, trial_end, amount_cents, currency, auto_renew, referral_code, affiliate_id, created_at, updated_at) VALUES($1,$2,$3,NOW() + ($4 * interval \'1 day\'),$5,$6,$7,$8,$9,NOW(),NOW()) ON CONFLICT (user_id) DO NOTHING',
    [userId, 'monthly', 'trialing', trialDays, 0, 'NGN', true, referralCode, affiliateId]
  );
}
