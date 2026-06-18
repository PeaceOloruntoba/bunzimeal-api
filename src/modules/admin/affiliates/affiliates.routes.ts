import { Router } from 'express';
import * as controller from './affiliates.controller.js';
import { requireAuth, requireAdmin } from '../../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/')
  .get(requireAuth, requireAdmin, controller.listAffiliates)
  .post(requireAuth, requireAdmin, controller.createAffiliate)
  .all(methodNotAllowed);

router.route('/:id')
  .patch(requireAuth, requireAdmin, controller.updateAffiliate)
  .delete(requireAuth, requireAdmin, controller.deleteAffiliate)
  .all(methodNotAllowed);

export default router;

