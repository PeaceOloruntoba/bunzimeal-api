import { Router } from 'express';
import * as controller from './ai-chat.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/session')
  .post(requireAuth, controller.ensureSession)
  .all(methodNotAllowed);

router.route('/chat')
  .post(requireAuth, controller.chat)
  .all(methodNotAllowed);

router.route('/plan')
  .post(requireAuth, controller.generatePlan)
  .all(methodNotAllowed);

router.route('/critique')
  .post(requireAuth, controller.critiquePlan)
  .all(methodNotAllowed);

router.route('/messages/:id')
  .get(requireAuth, controller.getMessages)
  .all(methodNotAllowed);

export default router;
