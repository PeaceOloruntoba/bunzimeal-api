import { Router } from 'express';
import * as controller from './affiliate-requests.controller.js';
import { requireAuth, requireAdmin } from '../../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/')
  .get(requireAuth, requireAdmin, controller.listAffiliateRequests)
  .all(methodNotAllowed);

router.route('/:id/approve')
  .post(requireAuth, requireAdmin, controller.approveRequest)
  .all(methodNotAllowed);

router.route('/:id/reject')
  .post(requireAuth, requireAdmin, controller.rejectRequest)
  .all(methodNotAllowed);

export default router;

