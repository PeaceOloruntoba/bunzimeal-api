import { env, isProd } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { PaystackService } from '../../utils/paystack.js';
import { sendMail } from '../../utils/mailer.js';
import * as billingRepo from './billing.repo.js';
import * as usersRepo from '../users/users.repo.js';
import * as referralsService from '../referrals/referrals.service.js';
import * as notificationsService from '../notifications/notifications.service.js';

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
  let sub = await billingRepo.getUserSubscription(userId);
  const now = new Date();
  let is_active = false;
  let next_billing_date: string | null = null;
  
  if (sub) {
    const end = sub.current_period_end || sub.trial_end;
    if ((sub.status === 'active' || sub.status === 'trialing') && end && new Date(end) > now) {
      is_active = true;
      next_billing_date = end;
    } else if ((sub.status === 'active' || sub.status === 'trialing') && end && new Date(end) <= now) {
      sub = await billingRepo.markSubscriptionExpired(userId) || { ...sub, status: 'expired', auto_renew: false };
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
      auto_renew: false,
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
  logger.info('Checking for expiring subscriptions...');
  const users = await usersRepo.listAllUsers();
  for (const user of users) {
    try {
      const sub = await billingRepo.getUserSubscription(user.id);
      if (!sub || (sub.status !== 'active' && sub.status !== 'trialing') || !sub.current_period_end) continue;
      
      const endDate = new Date(sub.current_period_end);
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
      const milestones = sub.plan === 'monthly' ? [7] : sub.plan === 'quarterly' ? [30, 7] : sub.plan === 'biannual' ? [60, 30, 7] : [90, 60, 30, 7];
      for (const milestone of milestones) {
        if (daysRemaining < 0 || daysRemaining > milestone || !(await billingRepo.claimExpiryNotification(sub.id, milestone))) continue;
        const title = `Your ${sub.plan} subscription expires in ${milestone} days`;
        const body = `Your BunziMeal subscription expires on ${endDate.toDateString()}. Renew manually before then to keep premium access.`;
        await notificationsService.sendNotification(user.id, title, body, { type: 'subscription_expiry', subscription_id: sub.id, milestone_days: milestone });
        if (user.email) {
          try { await sendMail(user.email, title, `<p>${body}</p>`); }
          catch (e) { logger.error({ userId: user.id, email: user.email, milestone }, 'Failed to send expiry email'); }
        }
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
