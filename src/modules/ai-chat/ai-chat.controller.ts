import type { Request, Response, NextFunction } from 'express';
import type { AuthedRequest } from '../../middlewares/auth.middleware.js';
import * as service from './ai-chat.service.js';
import * as aiRepo from './ai-chat.repo.js';
import type { Persona } from './ai-chat.repo.js';
import { PERSONAS, PERSONA_TITLES } from './ai-chat.repo.js';
import { chatRequestSchema, planRequestSchema, sessionRequestSchema } from './ai-chat.validator.js';
import { getUserPlan } from '../nutrition/nutrition.repo.js';

export async function ensureSession(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized', errorMessage: 'Please sign in' });

    const body = sessionRequestSchema.safeParse(req.body ?? {});
    const persona: Persona = (body.success ? body.data.persona : 'dietitian') ?? 'dietitian';

    const id = await aiRepo.getOrCreatePersonaSession(userId, persona);
    const session = await aiRepo.getSession(id, userId);

    const sessions = await aiRepo.listPersonaSessions(userId);
    const allThreads = PERSONAS.map((p) => {
      const existing = sessions.find((s) => s.persona === p);
      return {
        persona: p,
        title: existing?.title ?? `${PERSONA_TITLES[p]} Thread`,
        session_id: existing?.id ?? null,
        updated_at: existing?.updated_at ?? null,
      };
    });

    const messages = await service.listMessages(id, 50, 0);
    const history = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      token_usage: m.token_usage,
    }));

    const usage = await service.getUsage(userId);
    const limits = await service.checkUsageLimits(userId);

    res.json({
      success: true,
      data: {
        id,
        persona,
        title: session?.title,
        usage,
        limits,
        messages: history,
        threads: allThreads,
      },
    });
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
    const messages = await service.listMessages(sessionId, 200, 0);
    const history = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      token_usage: m.token_usage,
    }));
    const usage = await service.getUsage(userId);
    const limits = await service.checkUsageLimits(userId);
    res.json({ success: true, data: { messages: history, usage, limits, persona: session.persona } });
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
      const sessionId = await aiRepo.getOrCreatePersonaSession(userId, body.persona || 'dietitian');
      const messages = await service.listMessages(sessionId, 50, 0);
      const history = messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
        token_usage: m.token_usage,
      }));
      res.json({
        success: true,
        data: {
          message: { role: 'assistant' as const, text: response.text },
          messages: history,
          usage: response.usage,
          session_id: sessionId,
        },
      });
    }
  } catch (e: any) {
    if (e.message === 'TOKEN_LIMIT_EXCEEDED') {
      return res.status(402).json({ error: 'Token Limit Exceeded', errorMessage: 'Please upgrade to premium for unlimited AI access' });
    }
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
  } catch (e: any) {
    if (e.message === 'TOKEN_LIMIT_EXCEEDED') {
      return res.status(402).json({ error: 'Token Limit Exceeded', errorMessage: 'Please upgrade to premium for unlimited AI access' });
    }
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
    const persona: Persona = (req.body?.persona as Persona) ?? 'nutritionist';
    const critique = await service.critiquePlan(userId, plan, persona);
    res.json({ success: true, data: critique });
  } catch (e: any) {
    if (e.message === 'TOKEN_LIMIT_EXCEEDED') {
      return res.status(402).json({ error: 'Token Limit Exceeded', errorMessage: 'Please upgrade to premium for unlimited AI access' });
    }
    next(e);
  }
}
