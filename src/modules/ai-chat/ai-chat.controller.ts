import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as service from './ai-chat.service.js';
import * as aiRepo from './ai-chat.repo.js';
import { chatRequestSchema, planRequestSchema } from './ai-chat.validator.js';
import { getUserPlan } from '../nutrition/nutrition.repo.js';

export async function ensureSession(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const id = await service.getOrCreateSingleSession(userId);
    res.json({ success: true, data: { id } });
  } catch (e) {
    next(e);
  }
}

export async function getMessages(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const session = await aiRepo.getSession(sessionId, userId);
    if (!session) return res.status(404).json({ error: 'Not Found', errorMessage: 'Session not found' });
    const messages = await service.listMessages(sessionId, 50, 0);
    res.json({ success: true, data: messages });
  } catch (e) {
    next(e);
  }
}

export async function chat(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const body = chatRequestSchema.parse(req.body);
    if (body.stream) {
      // SSE streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      await service.chatStream(
        userId,
        body.message,
        (delta) => res.write(`data: ${JSON.stringify({ delta })}\n\n`),
        body.persona || 'dietitian'
      );
      res.write('data: {"done":true}\n\n');
      res.end();
    } else {
      const response = await service.chatOnce(userId, body.message, body.persona || 'dietitian');
      res.json({
        success: true,
        data: {
          message: { role: 'assistant', text: response.text },
          usage: response.usage
        }
      });
    }
  } catch (e) {
    next(e);
  }
}

export async function generatePlan(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    const body = planRequestSchema.parse(req.body);
    const planResult = await service.generatePlan(userId, body);
    res.json({ success: true, data: planResult });
  } catch (e) {
    next(e);
  }
}

export async function critiquePlan(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });
    let plan = req.body?.plan;
    if (!plan) plan = await getUserPlan(userId);
    if (!plan) return res.status(400).json({ error: 'No plan', errorMessage: 'Provide plan in body or generate one' });
    const critique = await service.critiquePlan(userId, plan);
    res.json({ success: true, data: critique });
  } catch (e) {
    next(e);
  }
}
