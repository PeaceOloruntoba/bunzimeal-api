import { Router } from 'express';
import * as controller from './health-engagement.controller.js';
import { requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/goals')
  .get(requireAuth, controller.getGoals)
  .put(requireAuth, controller.updateGoals)
  .all(methodNotAllowed);

router.route('/goals/available')
  .get(requireAuth, controller.listGoalKeys)
  .all(methodNotAllowed);

router.route('/streak')
  .get(requireAuth, controller.getStreak)
  .all(methodNotAllowed);

router.route('/health-logs')
  .get(requireAuth, controller.listHealthLogs)
  .post(requireAuth, controller.createHealthLog)
  .all(methodNotAllowed);

router.route('/health-logs/:id')
  .get(requireAuth, controller.getHealthLog)
  .patch(requireAuth, controller.updateHealthLog)
  .delete(requireAuth, controller.deleteHealthLog)
  .all(methodNotAllowed);

router.route('/perks')
  .get(requireAuth, controller.listPerks)
  .all(methodNotAllowed);

router.route('/validate-plan')
  .post(requireAuth, controller.validatePlan)
  .all(methodNotAllowed);

router.route('/apply-fixes')
  .post(requireAuth, controller.applyAutoFixes)
  .all(methodNotAllowed);

export default router;
