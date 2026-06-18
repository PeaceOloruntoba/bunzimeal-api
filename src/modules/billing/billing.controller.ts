import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as billingService from './billing.service.js';
import * as billingRepo from './billing.repo.js';
import * as usersRepo from '../users/users.repo.js';
import * as localizationRepo from '../localization/localization.repo.js';
import * as exchangeService from '../localization/localization.service.js';
import * as referralsService from '../referrals/referrals.service.js';
import { checkoutSchema, convertSchema } from './billing.validator.js';
import { env, isProd } from '../../config/env.js';
import { sendMail } from '../../utils/mailer.js';
import { detectCountryCode } from '../../utils/geo.js';
import { PaystackService } from '../../utils/paystack.js';
import crypto from 'crypto';

export async function publicPlanByCountry(req: Request, res: Response, next: NextFunction) {
  try {
    const countryIdRaw = req.query.country_id as string | undefined;
    const codeRaw = req.query.code as string | undefined;
    let countryId: number | null = null;

    if (countryIdRaw) {
      const id = parseInt(countryIdRaw, 10);
      if (!Number.isNaN(id)) countryId = id;
    }
    if (!countryId && codeRaw) {
      const c = await localizationRepo.getCountryByCode(codeRaw);
      if (c) countryId = c.id;
    }
    if (!countryId) {
      const code = detectCountryCode(req);
      if (code) {
        const c = await localizationRepo.getCountryByCode(code);
        if (c) countryId = c.id;
      }
    }
    // Fallback to Nigeria (126)
    if (!countryId) countryId = 126;

    const plan = await billingService.listPublicPlans(countryId);
    if (!plan) return res.status(404).json({ error: 'No plan for country' });
    return res.json(plan);
  } catch (e) {
    next(e);
  }
}

export async function listPlans(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    let countryId: number | null = null;
    try {
      const code = detectCountryCode(req as Request);
      if (code) {
        const c = await localizationRepo.getCountryByCode(code);
        if (c) countryId = c.id;
      }
    } catch (e) {
      // ignore geo lookup failures
    }
    if (!countryId) {
      const u = await usersRepo.getUserBasic(userId);
      if (u?.country?.id) countryId = u.country.id;
    }
    // Localhost fallback to Nigeria
    if (!countryId) {
      const host = (req.headers.host || '').toString();
      const isLocalHost = host.includes('localhost') || host.startsWith('127.') || !isProd;
      if (isLocalHost) countryId = 126;
    }

    const out = await billingService.listPlans(userId, countryId);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function getStatus(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const out = await billingService.getStatus(userId);
    res.json(out);
  } catch (e) {
    next(e);
  }
}

export async function convertCurrency(req: Request, res: Response, next: NextFunction) {
  try {
    const query = convertSchema.parse(req.query);
    const from = query.from;
    const amount = query.amount;
    const ex = await exchangeService.convertCurrency(from, 'NGN', amount);
    const converted = Number(ex.result || 0);
    return res.json({ rate: ex.rate, converted_major: converted, converted_cents: Math.round(converted * 100), raw: ex.raw });
  } catch (e) {
    next(e);
  }
}

export async function checkout(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const body = checkoutSchema.parse(req.body);
    const plan = body.plan;
    const callbackOverrideRaw = body.callback_url;
    const referralCode = body.referral_code?.trim();

    let countryId: number | null = null;
    try {
      const code = detectCountryCode(req as Request);
      if (code) {
        const c = await localizationRepo.getCountryByCode(code);
        if (c) countryId = c.id;
      }
    } catch (e) {
      // ignore
    }
    if (!countryId) {
      const u = await usersRepo.getUserBasic(userId);
      if (u?.country?.id) countryId = u.country.id;
    }
    if (!countryId) countryId = 126;

    const bp = await billingRepo.getBillingPlanByCountry(countryId);
    if (!bp) return res.status(404).json({ error: 'No billing plan for country' });

    let amountCents = 0;
    switch (plan) {
      case 'monthly': amountCents = bp.price_monthly_cents; break;
      case 'quarterly': amountCents = bp.price_quarterly_cents; break;
      case 'biannual': amountCents = bp.price_biannual_cents; break;
      case 'annual': amountCents = bp.price_annual_cents; break;
    }

    let appliedReferral: { type: 'percent_discount' | 'trial_days'; value: number } | null = null;
    if (referralCode) {
      const check = await referralsService.canRedeem(userId, referralCode);
      if ('ok' in check) {
        const aff = check.affiliate;
        if (aff.benefit === 'percent_discount') {
          const pct = Math.max(0, Math.min(aff.benefit_value, 100));
          const discounted = Math.round(amountCents * (1 - pct / 100));
          if (discounted >= 0) {
            amountCents = discounted;
            appliedReferral = { type: 'percent_discount', value: pct };
            await referralsService.redeem(userId, referralCode);
          }
        } else if (aff.benefit === 'trial_days') {
          const trialDays = Math.max(1, aff.benefit_value);
          const existingSub = await billingRepo.getUserSubscription(userId);
          const user = await usersRepo.getUserBasic(userId);
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + trialDays);
          
          await billingRepo.createOrUpdateUserSubscription(userId, {
            plan,
            status: 'trialing',
            trial_end: trialEnd.toISOString(),
            amount_cents: amountCents,
            currency: bp.currency,
            auto_renew: true,
            referral_code: referralCode,
            affiliate_id: aff.id
          });
          await referralsService.redeem(userId, referralCode);
          await referralsService.markApplied(userId);
          
          if (user?.email) {
            await sendMail(user.email, 'Trial Started', `<p>Your trial has been started! It expires on ${trialEnd.toDateString()}.</p>`);
          }
          
          return res.json({ trial_applied: true, trial_days: trialDays });
        }
      }
    }

    const payment = await billingRepo.createPayment(userId, {
      amount_cents: amountCents,
      currency: bp.currency,
      metadata: { plan, referral_code: referralCode || null, referral: appliedReferral }
    });

    let paystackAmount = amountCents;
    let paystackCurrency = bp.currency || 'NGN';
    let conversionMeta: any = null;

    const wantsConvert = !!((req.body as any)?.convert || (bp.currency && bp.currency.toUpperCase() !== 'NGN'));
    if (wantsConvert) {
      const sourceAmountMajor = amountCents / 100;
      try {
        const ex = await exchangeService.convertCurrency(bp.currency || 'NGN', 'NGN', sourceAmountMajor);
        const convertedMajor = Number(ex.result || 0);
        const convertedCents = Math.round(convertedMajor * 100);
        paystackAmount = convertedCents;
        paystackCurrency = 'NGN';
        conversionMeta = { rate: ex.rate, converted_major: convertedMajor };
      } catch (err) {
        await billingRepo.updatePayment(payment.id, { status: 'failed', failure_message: String(err) });
        return res.status(500).json({ error: 'Failed to convert currency' });
      }
    }

    if (!env.PAYSTACK_SECRET_KEY) return res.status(500).json({ error: 'Payment gateway not configured' });
    let callback = `${env.FRONTEND_BASE_URL || 'http://localhost:3000'}/app/billing/processing`;
    if (typeof callbackOverrideRaw === 'string' && callbackOverrideRaw.trim().length > 0) {
      callback = callbackOverrideRaw.trim();
    }

    const user = await usersRepo.getUserBasic(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reference = `bunzi-${userId}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const initData = await PaystackService.initializeTransaction(
      user.email,
      paystackAmount / 100, // Paystack expects major units
      reference,
      { user_id: userId, plan, payment_id: payment.id, original_currency: bp.currency, original_amount: amountCents / 100, conversion: conversionMeta, referral_code: referralCode || null, referral: appliedReferral, callback_url_override: callbackOverrideRaw ? callback : undefined }
    );

    await billingRepo.updatePayment(payment.id, {
      reference,
      gateway_payment_id: initData.id,
      metadata: { ...(payment.metadata || {}), paystack_currency: paystackCurrency, conversion: conversionMeta }
    });

    const existingSub = await billingRepo.getUserSubscription(userId);
    let subscriptionId: string | null = null;
    if (!existingSub) {
      const trialDays = 14;
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + trialDays);
      const newSub = await billingRepo.createOrUpdateUserSubscription(userId, {
        plan,
        status: 'trialing',
        trial_end: trialEnd.toISOString(),
        amount_cents: amountCents,
        currency: bp.currency,
        auto_renew: true,
        referral_code: referralCode || null
      });
      subscriptionId = newSub.id;
      if (user.email) {
        await sendMail(user.email, 'Trial Started', `<p>Your trial has been started! It expires on ${trialEnd.toDateString()}.</p>`);
      }
    } else {
      subscriptionId = existingSub.id;
    }

    if (subscriptionId) {
      await billingRepo.updatePayment(payment.id, {
        metadata: { ...(payment.metadata || {}), subscription_id: subscriptionId }
      });
    }

    return res.json({ reference, authorization_url: initData.authorization_url });
  } catch (e) {
    next(e);
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    await billingService.handlePaystackWebhook(req.body);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(200).json({ ok: true }); // Always return 200 to prevent Paystack retries
  }
}
