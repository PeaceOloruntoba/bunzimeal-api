import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as repo from './health-engagement.repo.js';
import * as service from './health-engagement.service.js';
import {
  updateGoalsSchema,
  createHealthLogSchema,
  updateHealthLogSchema,
  listHealthLogsSchema,
  createCheckinSchema,
  listCheckinsSchema,
  healthSummarySchema,
  bulkLogSchema,
  readRecommendationsSchema,
} from './health-engagement.validator.js';

export async function getGoals(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const goals = await service.getUserGoals(userId);
    return res.json({ success: true, message: 'Goals retrieved', data: { goals } });
  } catch (e) {
    next(e);
  }
}

export async function updateGoals(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const body = updateGoalsSchema.parse(req.body);
    const profile = await service.setUserGoals(userId, body.goals);
    const goals = await service.getUserGoals(userId);
    return res.json({ success: true, message: 'Goals updated', data: { goals, profile } });
  } catch (e) {
    next(e);
  }
}

export async function listGoalKeys(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const keys = await service.listAvailableGoalKeys();
    return res.json({ success: true, message: 'Available goal keys retrieved', data: { keys } });
  } catch (e) {
    next(e);
  }
}

export async function getStreak(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const streak = await repo.getUserStreak(userId);
    return res.json({ success: true, message: 'Streak retrieved', data: { streak } });
  } catch (e) {
    next(e);
  }
}

export async function listHealthLogs(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const query = listHealthLogsSchema.parse(req.query);
    const logs = await repo.listHealthLogs(userId, query.from, query.to, query.log_type);
    return res.json({ success: true, message: 'Health logs retrieved', data: { logs } });
  } catch (e) {
    next(e);
  }
}

export async function getHealthLog(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const logId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const log = await repo.getHealthLog(userId, logId);
    if (!log) return res.status(404).json({ error: 'Not Found', errorMessage: 'Health log not found' });

    return res.json({ success: true, message: 'Health log retrieved', data: { log } });
  } catch (e) {
    next(e);
  }
}

export async function createHealthLog(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const body = createHealthLogSchema.parse(req.body);
    const logDate = body.log_date || new Date().toISOString().slice(0, 10);

    const log = await repo.createHealthLog(userId, {
      ...body,
      notes: body.notes ?? null,
      metadata: body.metadata ?? null,
      log_date: logDate,
    });

    await service.checkAndUpdateStreak(userId, logDate);
    await service.checkEngagementBadges(userId);
    return res.status(201).json({ success: true, message: 'Health log created', data: { log } });
  } catch (e) {
    next(e);
  }
}

export async function bulkCreateHealthLogs(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const body = bulkLogSchema.parse(req.body);
    const logs = await service.logBulkEntries(userId, body.entries, body.log_date);
    await service.checkEngagementBadges(userId);
    return res.status(201).json({ success: true, message: 'Entries logged', data: { logs } });
  } catch (e) {
    next(e);
  }
}

export async function updateHealthLog(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const logId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const body = updateHealthLogSchema.parse(req.body);

    const updateData = {
      ...body,
      notes: body.notes ?? null,
      metadata: body.metadata ?? null,
    };
    const log = await repo.updateHealthLog(userId, logId, updateData);
    if (!log) return res.status(404).json({ error: 'Not Found', errorMessage: 'Health log not found' });

    return res.json({ success: true, message: 'Health log updated', data: { log } });
  } catch (e) {
    next(e);
  }
}

export async function deleteHealthLog(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const logId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const log = await repo.getHealthLog(userId, logId);
    if (!log) return res.status(404).json({ error: 'Not Found', errorMessage: 'Health log not found' });

    await repo.deleteHealthLog(userId, logId);
    return res.json({ success: true, message: 'Health log deleted' });
  } catch (e) {
    next(e);
  }
}

export async function listPerks(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const perks = await repo.listUserPerks(userId);
    return res.json({ success: true, message: 'Perks retrieved', data: { perks } });
  } catch (e) {
    next(e);
  }
}

export async function validatePlan(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const plan = req.body;
    const result = await service.validatePlanAgainstUserGoals(userId, plan);
    return res.json({ success: true, message: 'Plan validated', data: result });
  } catch (e) {
    next(e);
  }
}

export async function applyAutoFixes(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const { plan, violations } = req.body;
    const result = await service.applyAutoFixes(plan, violations);
    return res.json({ success: true, message: 'Auto fixes applied', data: result });
  } catch (e) {
    next(e);
  }
}

export async function createCheckin(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const body = createCheckinSchema.parse(req.body);
    const checkin = await service.saveCheckin(userId, body);
    await service.checkEngagementBadges(userId);
    return res.status(201).json({ success: true, message: 'Check-in saved', data: { checkin } });
  } catch (e) {
    next(e);
  }
}

export async function listCheckins(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const q = listCheckinsSchema.parse(req.query);
    const checkins = await repo.listCheckins(userId, q.from, q.to);
    return res.json({ success: true, message: 'Check-ins retrieved', data: { checkins } });
  } catch (e) {
    next(e);
  }
}

export async function getCheckinToday(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const today = new Date().toISOString().slice(0, 10);
    const checkin = await repo.getCheckinByDate(userId, today);
    return res.json({ success: true, message: 'Check-in retrieved', data: { checkin } });
  } catch (e) {
    next(e);
  }
}

export async function getHealthSummary(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const q = healthSummarySchema.parse(req.query);
    const days = q.period === '7d' ? 7 : q.period === '30d' ? 30 : 90;
    const summary = await repo.getHealthSummary(userId, days);
    return res.json({ success: true, message: 'Summary retrieved', data: { summary } });
  } catch (e) {
    next(e);
  }
}

export async function getHealthInsights(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const q = healthSummarySchema.parse(req.query);
    const days = q.period === '7d' ? 7 : q.period === '30d' ? 30 : 90;
    const insights = await service.generateHealthInsights(userId, days);
    return res.json({ success: true, message: 'Insights generated', data: insights });
  } catch (e) {
    next(e);
  }
}

export async function getDailyTip(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const tip = await service.generateDailyTip(userId);
    return res.json({ success: true, message: 'Tip generated', data: { tip } });
  } catch (e) {
    next(e);
  }
}

export async function getPersonalAdvice(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const advice = await service.getAiAdvice(userId);
    return res.json({ success: true, message: 'Advice generated', data: { advice } });
  } catch (e) {
    next(e);
  }
}

export async function listRecommendations(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const unread = req.query.unread === '1' || req.query.unread === 'true';
    const limit = Number(req.query.limit as any) || 20;
    await service.seedDailyTipIfEmpty(userId);
    const recs = await repo.listRecommendations(userId, unread, limit);
    return res.json({ success: true, message: 'Recommendations retrieved', data: { recommendations: recs } });
  } catch (e) {
    next(e);
  }
}

export async function markRecommendationsRead(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const body = readRecommendationsSchema.parse(req.body);
    await repo.markRecommendationsRead(userId, body.ids, !!body.all);
    return res.json({ success: true, message: 'Marked as read' });
  } catch (e) {
    next(e);
  }
}

export async function getBadgeCheck(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const badges = await service.checkEngagementBadges(userId);
    return res.json({ success: true, message: 'Badges evaluated', data: { newly_awarded: badges } });
  } catch (e) {
    next(e);
  }
}
