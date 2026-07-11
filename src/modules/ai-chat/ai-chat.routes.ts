import { Router } from 'express';
import * as controller from './ai-chat.controller.js';
import { requireAuth, requirePremium } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/session')
  .post(requireAuth, requirePremium, controller.ensureSession)
  .all(methodNotAllowed);

router.route('/chat')
  .post(requireAuth, requirePremium, controller.chat)
  .all(methodNotAllowed);

router.route('/plan')
  .post(requireAuth, requirePremium, controller.generatePlan)
  .all(methodNotAllowed);

router.route('/critique')
  .post(requireAuth, requirePremium, controller.critiquePlan)
  .all(methodNotAllowed);

router.route('/messages/:id')
  .get(requireAuth, requirePremium, controller.getMessages)
  .all(methodNotAllowed);

export default router;
