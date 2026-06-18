import { Router } from 'express';
import * as controller from './shopping-list.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/')
  .get(requireAuth, controller.listShopping)
  .post(requireAuth, controller.createShoppingItem)
  .all(methodNotAllowed);

router.route('/:id')
  .get(requireAuth, controller.getShoppingItem)
  .put(requireAuth, controller.updateShoppingItem)
  .delete(requireAuth, controller.deleteShoppingItem)
  .all(methodNotAllowed);

export default router;
