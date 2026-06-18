import bcrypt from 'bcryptjs';
import { signToken } from '../../utils/jwt.js';
import { sendOtpEmail, sendResetEmail } from '../../utils/mailer.js';
import { logger } from '../../config/logger.js';
import * as repo from './auth.repo.js';
import { env, isProd } from '../../config/env.js';

export type RegisterResult = { ok: true; userId: string; code?: string } | { conflict: true };

export async function registerUser(email: string, password: string, firstName: string, lastName: string, countryId: number, referralCode?: string | null): Promise<RegisterResult> {
  const existingUser = await repo.getUserByEmail(email);
  if (existingUser) return { conflict: true };
  
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await repo.createUser(email, passwordHash, firstName, lastName, countryId);
  
  await repo.createProfile(user.id);
  
  let affiliateId: string | null = null;
  if (referralCode) {
    try {
      const aff = await repo.getAffiliateByCode(referralCode);
      if (aff && aff.active) {
        const now = new Date();
        const canUse = (!aff.starts_at || new Date(aff.starts_at) <= now) && (!aff.ends_at || new Date(aff.ends_at) >= now);
        const count = await repo.getRedemptionCount(aff.id);
        const alreadyRedeemed = await repo.hasUserRedeemed(user.id);
        
        if (canUse && count < aff.cap && !alreadyRedeemed) {
          await repo.createReferralRedemption(user.id, aff.id, aff.code, aff.benefit, aff.benefit_value);
          await repo.setUserReferredByAffiliate(user.id, aff.id);
          affiliateId = aff.id;
        }
      }
    } catch (e) {
      logger.warn({ e, referralCode }, 'Failed to process referral code');
    }
  }
  
  await repo.createUserSubscription(user.id, referralCode || null, affiliateId);
  
  const code = await repo.issueOtp(user.id, 'verify_email', null);
  await sendOtpEmail(email, code);
  
  logger.info({ email }, 'User registered and OTP sent');
  
  if (!isProd) {
    return { ok: true, userId: user.id, code };
  }
  return { ok: true, userId: user.id };
}

export type VerifyResult = { ok: true } | { notFound: true } | { invalid: true } | { used: true } | { expired: true };

export async function verifyEmailOtp(email: string, code: string): Promise<VerifyResult> {
  const user = await repo.getUserByEmail(email);
  if (!user) return { notFound: true };
  
  const otps = await repo.getUnusedOtpsForUser(user.id, 'verify_email');
  for (const otp of otps) {
    const ok = await bcrypt.compare(code, otp.otp_hash);
    if (ok) {
      await repo.markOtpAsUsed(otp.id);
      await repo.verifyUser(user.id);
      logger.info({ email }, 'Email OTP verified');
      return { ok: true };
    } else {
      await repo.incrementOtpAttempts(otp.id);
    }
  }
  
  return { invalid: true };
}

export type LoginResult = { ok: true; token: string; refreshToken: string; user: { id: string; email: string; firstName: string | null; lastName: string | null; role: 'user' | 'admin' } } | { invalid: true } | { unverified: true };

export async function loginUser(email: string, password: string, options?: { userAgent?: string; ipAddress?: string }): Promise<LoginResult> {
  const user = await repo.getUserByEmail(email);
  if (!user) return { invalid: true };
  
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { invalid: true };
  
  if (!user.verified_at) return { unverified: true };
  
  const token = signToken({ sub: user.id, email, tv: user.token_version });
  const { token: refreshToken } = await repo.createRefreshToken(user.id, { userAgent: options?.userAgent, ipAddress: options?.ipAddress });
  
  return { 
    ok: true, 
    token, 
    refreshToken, 
    user: { 
      id: user.id, 
      email, 
      firstName: user.first_name, 
      lastName: user.last_name, 
      role: user.role 
    } 
  };
}

export type RefreshResult = { ok: true; token: string; refreshToken: string; user: { id: string; email: string; firstName: string | null; lastName: string | null; role: 'user' | 'admin' } } | { invalid: true } | { expired: true };

export async function refreshAccessToken(rawToken: string, options?: { userAgent?: string; ipAddress?: string }): Promise<RefreshResult> {
  const parts = String(rawToken).split('.');
  if (parts.length !== 2) return { invalid: true };
  const [selector, validator] = parts;
  
  const refreshToken = await repo.getRefreshTokenBySelector(selector);
  if (!refreshToken) return { invalid: true };
  if (new Date(refreshToken.expires_at) < new Date()) return { expired: true };
  
  const ok = await bcrypt.compare(validator, refreshToken.token_hash);
  if (!ok) {
    await repo.revokeRefreshTokenBySelector(selector);
    return { invalid: true };
  }
  
  await repo.revokeRefreshTokenBySelector(selector);
  const { token: newRefreshToken } = await repo.createRefreshToken(refreshToken.user_id, { userAgent: options?.userAgent, ipAddress: options?.ipAddress });
  
  const user = await repo.getUserById(refreshToken.user_id);
  const token = signToken({ sub: user.id, email: user.email, tv: user.token_version });
  
  return { 
    ok: true, 
    token, 
    refreshToken: newRefreshToken, 
    user: { 
      id: user.id, 
      email: user.email, 
      firstName: user.first_name, 
      lastName: user.last_name, 
      role: user.role 
    } 
  };
}

export async function logout(rawToken?: string) {
  if (rawToken) {
    const parts = String(rawToken).split('.');
    if (parts.length === 2) {
      await repo.revokeRefreshTokenBySelector(parts[0]);
    }
  }
}

export async function logoutAll(userId: string) {
  await repo.revokeAllRefreshTokensForUser(userId);
  await repo.incrementTokenVersion(userId);
}

export type ResendOtpResult = { ok: true } | { alreadyVerified: true };

export async function resendOtp(email: string, purpose: 'verify' | 'password_reset'): Promise<ResendOtpResult> {
  const user = await repo.getUserByEmail(email);
  if (!user) return { ok: true };
  
  if (purpose === 'verify' && user.verified_at) return { alreadyVerified: true };
  
  const code = await repo.issueOtp(user.id, purpose === 'verify' ? 'verify_email' : 'password_reset', null);
  
  if (purpose === 'verify') {
    await sendOtpEmail(email, code);
  } else {
    await sendResetEmail(email, code);
  }
  
  logger.info({ email, purpose }, `${purpose === 'verify' ? 'Verification' : 'Password reset'} OTP re-sent`);
  return { ok: true };
}

export async function createPasswordResetOtp(email: string) {
  const user = await repo.getUserByEmail(email);
  if (!user) return;
  
  const code = await repo.issueOtp(user.id, 'password_reset', null);
  await sendResetEmail(email, code);
  logger.info({ email }, 'Password reset OTP generated');
}

export type ResetPasswordResult = { ok: true } | { invalid: true } | { expired: true };

export async function resetPasswordWithOtp(email: string, code: string, password: string): Promise<ResetPasswordResult> {
  const user = await repo.getUserByEmail(email);
  if (!user) return { invalid: true };
  
  const otps = await repo.getUnusedOtpsForUser(user.id, 'password_reset');
  for (const otp of otps) {
    const ok = await bcrypt.compare(code, otp.otp_hash);
    if (ok) {
      await repo.markOtpAsUsed(otp.id);
      const hash = await bcrypt.hash(password, 10);
      await repo.updateUserPassword(user.id, hash);
      logger.info({ email }, 'Password reset with OTP');
      return { ok: true };
    } else {
      await repo.incrementOtpAttempts(otp.id);
    }
  }
  
  return { invalid: true };
}
