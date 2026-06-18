import { Router } from 'express';
import * as controller from './admin-content.controller.js';
import { requireAuth, requireAdmin } from '../../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/site-contents')
  .get(requireAuth, requireAdmin, controller.getContents)
  .patch(requireAuth, requireAdmin, controller.updateContents)
  .all(methodNotAllowed);

router.route('/faqs')
  .get(requireAuth, requireAdmin, controller.listFaqs)
  .post(requireAuth, requireAdmin, controller.createFaq)
  .all(methodNotAllowed);

router.route('/faqs/:id')
  .patch(requireAuth, requireAdmin, controller.updateFaq)
  .delete(requireAuth, requireAdmin, controller.deleteFaq)
  .all(methodNotAllowed);

export default router;

