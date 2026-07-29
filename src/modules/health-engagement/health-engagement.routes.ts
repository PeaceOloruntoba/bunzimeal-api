import { Router } from 'express';
import * as controller from './health-engagement.controller.js';
import { fakeAuth, requireAuth } from '../../middlewares/auth.middleware.js';
import { methodNotAllowed } from '../../middlewares/methodNotAllowed.middleware.js';

const router = Router();

router.route('/goals')
  .get(requireAuth, controller.getGoals)
  .put(requireAuth, controller.updateGoals)
  .all(methodNotAllowed);

router.route('/goals/available')
  .get(fakeAuth, controller.listGoalKeys)
  .all(methodNotAllowed);

router.route('/streak')
  .get(requireAuth, controller.getStreak)
  .all(methodNotAllowed);

router.route('/health-logs')
  .get(requireAuth, controller.listHealthLogs)
  .post(requireAuth, controller.createHealthLog)
  .all(methodNotAllowed);

router.route('/health-logs/bulk')
  .post(requireAuth, controller.bulkCreateHealthLogs)
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

router.route('/checkins')
  .get(requireAuth, controller.listCheckins)
  .post(requireAuth, controller.createCheckin)
  .all(methodNotAllowed);

router.route('/checkins/today')
  .get(requireAuth, controller.getCheckinToday)
  .all(methodNotAllowed);

router.route('/summary')
  .get(requireAuth, controller.getHealthSummary)
  .all(methodNotAllowed);

router.route('/insights')
  .get(requireAuth, controller.getHealthInsights)
  .all(methodNotAllowed);

router.route('/daily-tip')
  .get(requireAuth, controller.getDailyTip)
  .all(methodNotAllowed);

router.route('/advice')
  .get(requireAuth, controller.getPersonalAdvice)
  .all(methodNotAllowed);

router.route('/recommendations')
  .get(requireAuth, controller.listRecommendations)
  .patch(requireAuth, controller.markRecommendationsRead)
  .all(methodNotAllowed);

router.route('/badges/check')
  .post(requireAuth, controller.getBadgeCheck)
  .all(methodNotAllowed);

export default router;
