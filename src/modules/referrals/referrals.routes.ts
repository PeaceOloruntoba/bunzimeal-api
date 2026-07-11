import { Router } from 'express';
import * as controller from './referrals.controller.js';
import { requireAuth, requirePremium } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/validate')
  .get(controller.validateReferralCode)
  .all(methodNotAllowed);

router.route('/redeem')
  .post(requireAuth, controller.redeemReferral)
  .all(methodNotAllowed);

router.route('/request')
  .post(requireAuth, requirePremium, controller.requestAffiliate)
  .all(methodNotAllowed);

router.route('/status')
  .get(requireAuth, requirePremium, controller.getReferralStatus)
  .all(methodNotAllowed);

router.route('/stats')
  .get(requireAuth, requirePremium, controller.getReferralStats)
  .all(methodNotAllowed);

export default router;
