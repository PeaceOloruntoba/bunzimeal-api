import { Router } from 'express';
import * as controller from './pantry.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/')
  .get(requireAuth, controller.listPantry)
  .post(requireAuth, controller.createPantryItem)
  .all(methodNotAllowed);

router.route('/:id')
  .get(requireAuth, controller.getPantryItem)
  .put(requireAuth, controller.updatePantryItem)
  .delete(requireAuth, controller.deletePantryItem)
  .all(methodNotAllowed);

export default router;
