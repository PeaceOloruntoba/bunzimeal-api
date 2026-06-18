import { Router } from 'express';
import * as controller from './referrals.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/validate')
  .get(controller.validateReferralCode)
  .all(methodNotAllowed);

router.route('/redeem')
  .post(requireAuth, controller.redeemReferral)
  .all(methodNotAllowed);

router.route('/request')
  .post(requireAuth, controller.requestAffiliate)
  .all(methodNotAllowed);

router.route('/status')
  .get(requireAuth, controller.getReferralStatus)
  .all(methodNotAllowed);

router.route('/stats')
  .get(requireAuth, controller.getReferralStats)
  .all(methodNotAllowed);

export default router;
