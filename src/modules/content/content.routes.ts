import { Router } from 'express';
import * as controller from './content.controller.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/')
  .get(controller.publicGetContents)
  .all(methodNotAllowed);

router.route('/faqs')
  .get(controller.publicListFaqs)
  .all(methodNotAllowed);

export default router;

