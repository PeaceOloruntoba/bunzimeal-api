import { Router } from 'express';
import * as controller from './localization.controller.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/countries')
  .get(controller.listCountries)
  .all(methodNotAllowed);

export default router;
