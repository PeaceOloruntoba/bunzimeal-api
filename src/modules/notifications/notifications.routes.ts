import { Router } from 'express';
import * as controller from './notifications.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/')
  .get(requireAuth, controller.getNotifications)
  .all(methodNotAllowed);

router.route('/push-tokens')
  .get(requireAuth, controller.getPushTokens)
  .post(requireAuth, controller.registerPushToken)
  .all(methodNotAllowed);

router.route('/push-tokens/:id')
  .patch(requireAuth, controller.updatePushToken)
  .delete(requireAuth, controller.deletePushToken)
  .all(methodNotAllowed);

export default router;
