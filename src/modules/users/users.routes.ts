import { Router } from 'express';
import * as controller from './users.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/profile')
  .get(requireAuth, controller.getProfile)
  .patch(requireAuth, controller.updateProfile)
  .all(methodNotAllowed);

router.route('/stats/summary')
  .get(requireAuth, controller.statsSummary)
  .all(methodNotAllowed);

export default router;
