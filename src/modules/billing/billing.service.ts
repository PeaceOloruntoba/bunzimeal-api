import { env, isProd } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { PaystackService } from '../../utils/paystack.js';
import { sendMail } from '../../utils/mailer.js';
import * as billingRepo from './billing.repo.js';
import * as usersRepo from '../users/users.repo.js';
import * as referralsService from '../referrals/referrals.service.js';

export type Plan = 'monthly' | 'quarterly' | 'biannual' | 'annual';

function computeDerivedCents(priceWhole: number) {
  const price_cents = Math.round(priceWhole * 100);
  const price_monthly_cents = price_cents;
  const price_quarterly_cents = Math.round(price_cents * 2.5);
  const price_biannual_cents = Math.round(price_cents * 5);
  const price_annual_cents = Math.round(price_cents * 10);
  return {
    price_cents,
    price_monthly_cents,
    price_quarterly_cents,
    price_biannual_cents,
    price_annual_cents
  };
}

export async function listPlans(userId: string, countryId: number | null) {
  if (!countryId) {
    // Fallback to Nigeria
    countryId = 126;
  }
  const bp = await billingRepo.getBillingPlanByCountry(countryId);
  if (!bp) return null;
  return {
    is_active: true,
    country: { id: bp.country_id, currency: bp.currency },
    plans: [
      { plan: 'monthly', price_cents: bp.price_monthly_cents, currency: bp.currency },
      { plan: 'quarterly', price_cents: bp.price_quarterly_cents, currency: bp.currency },
      { plan: 'biannual', price_cents: bp.price_biannual_cents, currency: bp.currency },
      { plan: 'annual', price_cents: bp.price_annual_cents, currency: bp.currency },
    ],
  };
}

export async function listPublicPlans(countryId: number) {
  const bp = await billingRepo.getBillingPlanByCountry(countryId);
  if (!bp) return null;
  return {
    is_active: true,
    country: { id: bp.country_id, currency: bp.currency },
    plans: [
      { plan: 'monthly', price_cents: bp.price_monthly_cents, currency: bp.currency },
      { plan: 'quarterly', price_cents: bp.price_quarterly_cents, currency: bp.currency },
      { plan: 'biannual', price_cents: bp.price_biannual_cents, currency: bp.currency },
      { plan: 'annual', price_cents: bp.price_annual_cents, currency: bp.currency },
    ],
  };
}

export async function getStatus(userId: string) {
  const sub = await billingRepo.getUserSubscription(userId);
  const now = new Date();
  let is_active = false;
  let next_billing_date: string | null = null;
  
  if (sub) {
    if (sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) > now) {
      is_active = true;
      next_billing_date = sub.current_period_end;
    } else if (sub.status === 'active' && sub.current_period_end && new Date(sub.current_period_end) <= now) {
      // Mark as expired if period ended
      await billingRepo.createOrUpdateUserSubscription(userId, { status: 'expired' });
    }
  }
  return { is_active, next_billing_date, subscription: sub };
}

export async function handlePaystackWebhook(event: any) {
  const eventType = event.event;
  logger.info({ eventType }, 'Received Paystack webhook');
  
  if (eventType === 'charge.success') {
    const data = event.data;
    const reference = data.reference;
    const payment = await billingRepo.getPaymentByReference(reference);
    
    if (!payment) {
      logger.warn({ reference }, 'Payment not found for webhook');
      return;
    }
    
    await billingRepo.updatePayment(payment.id, {
      status: 'completed',
      gateway_payment_id: data.id,
      metadata: { ...payment.metadata, paystack_event: data }
    });
    
    const userId = payment.user_id;
    // Extend user's subscription
    const existingSub = await billingRepo.getUserSubscription(userId);
    const plan = (payment.metadata as any)?.plan || 'monthly';
    const months = plan === 'monthly' ? 1 : plan === 'quarterly' ? 3 : plan === 'biannual' ? 6 : 12;
    const now = new Date();
    const currentEnd = existingSub?.current_period_end ? new Date(existingSub.current_period_end) : now;
    const newEnd = new Date(Math.max(now.getTime(), currentEnd.getTime()));
    newEnd.setMonth(newEnd.getMonth() + months);
    
    await billingRepo.createOrUpdateUserSubscription(userId, {
      plan,
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: newEnd.toISOString(),
      amount_cents: payment.amount_cents,
      currency: payment.currency,
      auto_renew: false, // No auto-renew
      referral_code: (payment.metadata as any)?.referral_code,
    });
    
    const user = await usersRepo.getUserBasic(userId);
    if (user?.email) {
      try {
        await sendMail(user.email, 'Subscription Successful', `<p>Your subscription has been activated successfully! It expires on ${newEnd.toDateString()}.</p>`);
      } catch (e) {
        logger.error({ userId, email: user.email }, 'Failed to send subscription confirmation email');
      }
    }
    
    // Check if referral code was applied and mark it
    if ((payment.metadata as any)?.referral_code) {
      try {
        await referralsService.markApplied(userId);
      } catch (e) {
        logger.error({ userId }, 'Failed to mark referral applied');
      }
    }
  } else if (eventType === 'invoice.payment_failed') {
    const data = event.data;
    logger.warn({ invoiceId: data.id }, 'Invoice payment failed');
  }
}

// New function to check and send 7-day expiry notifications
export async function sendExpiryNotifications() {
  const now = new Date();
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  
  // Get subscriptions expiring in 7 days (with status 'active' and not already notified)
  // For now, we'll just log - we need to track if notifications were already sent
  logger.info('Checking for expiring subscriptions...');
  
  // Let's implement this with a simple check
  const users = await usersRepo.listAllUsers();
  for (const user of users) {
    try {
      const sub = await billingRepo.getUserSubscription(user.id);
      if (!sub || sub.status !== 'active' || !sub.current_period_end) continue;
      
      const endDate = new Date(sub.current_period_end);
      // Check if end date is exactly 7 days from now (ignore time)
      const isSevenDaysBefore = 
        endDate.getFullYear() === sevenDaysFromNow.getFullYear() &&
        endDate.getMonth() === sevenDaysFromNow.getMonth() &&
        endDate.getDate() === sevenDaysFromNow.getDate();
      
      if (isSevenDaysBefore && user.email) {
        logger.info(`Sending expiry notification to ${user.email}`);
        await sendMail(user.email, 'Your subscription is expiring soon', 
          `<p>Your subscription is set to expire on ${endDate.toDateString()}. Renew now to continue enjoying premium features!</p>`);
      }
    } catch (e) {
      logger.error({ userId: user.id }, 'Failed to check/send expiry notification');
    }
  }
}

export async function upsertCountryPrice(countryId: number, currency: string, priceWhole: number) {
  const derived = computeDerivedCents(priceWhole);
  return await billingRepo.upsertBillingPlan(countryId, currency, priceWhole, derived);
}
