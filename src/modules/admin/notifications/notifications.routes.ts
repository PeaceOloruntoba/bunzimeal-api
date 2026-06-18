import { Router } from 'express';
import * as controller from './notifications.controller.js';
import { requireAuth, requireAdmin } from '../../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/newsletters')
  .post(requireAuth, requireAdmin, controller.create)
  .get(requireAuth, requireAdmin, controller.list)
  .all(methodNotAllowed);

router.route('/newsletters/preview')
  .post(requireAuth, requireAdmin, controller.preview)
  .all(methodNotAllowed);

router.route('/newsletters/:id')
  .get(requireAuth, requireAdmin, controller.getById)
  .all(methodNotAllowed);

export default router;

