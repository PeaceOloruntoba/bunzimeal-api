import type { Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as repo from './health-engagement.repo.js';
import * as service from './health-engagement.service.js';
import {
  updateGoalsSchema,
  createHealthLogSchema,
  updateHealthLogSchema,
  listHealthLogsSchema
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
    const logs = await repo.listHealthLogs(userId, query.from, query.to);
    return res.json({ success: true, message: 'Health logs retrieved', data: { logs } });
  } catch (e) {
    next(e);
  }
}

export async function getHealthLog(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const logId = req.params.id;
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
      log_date: logDate
    });
    
    await service.checkAndUpdateStreak(userId, logDate);
    
    return res.status(201).json({ success: true, message: 'Health log created', data: { log } });
  } catch (e) {
    next(e);
  }
}

export async function updateHealthLog(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    
    const logId = req.params.id;
    const body = updateHealthLogSchema.parse(req.body);
    
    const log = await repo.updateHealthLog(userId, logId, body);
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
    
    const logId = req.params.id;
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
