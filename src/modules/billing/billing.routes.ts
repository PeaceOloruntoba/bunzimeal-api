import { Router } from 'express';
import * as controller from './billing.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/public-plan')
  .get(controller.publicPlanByCountry)
  .all(methodNotAllowed);

router.route('/plans')
  .get(requireAuth, controller.listPlans)
  .all(methodNotAllowed);

router.route('/status')
  .get(requireAuth, controller.getStatus)
  .all(methodNotAllowed);

router.route('/convert')
  .get(controller.convertCurrency)
  .all(methodNotAllowed);

router.route('/checkout')
  .post(requireAuth, controller.checkout)
  .all(methodNotAllowed);

router.route('/webhook')
  .post(controller.handleWebhook)
  .all(methodNotAllowed);

export default router;
