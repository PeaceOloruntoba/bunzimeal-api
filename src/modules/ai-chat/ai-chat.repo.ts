import { query } from '../../db/pool.js';

export interface AISession {
  id: string;
  user_id: string;
  persona: string | null;
  title: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AIMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'assistant' | 'system';
  content: any;
  artifact_id: string | null;
  token_usage: number | null;
  created_at: Date;
}

export interface AIArtifact {
  id: string;
  user_id: string;
  type: string;
  data: any;
  created_at: Date;
}

export interface AIMemory {
  id: string;
  user_id: string;
  kind: string;
  content: any;
  created_at: Date;
  updated_at: Date;
}

export interface AIUsage {
  id: string;
  user_id: string;
  session_id: string | null;
  period_start: Date;
  period_end: Date;
  total_tokens_used: number;
}

// Get current period (monthly)
function getCurrentPeriod() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// AI Sessions
export async function getOrCreateSingleSession(userId: string) {
  const { rows } = await query<{ id: string }>('SELECT id FROM ai_sessions WHERE user_id=$1 LIMIT 1', [userId]);
  if (rows.length) return rows[0].id;

  const { rows: userRows } = await query<{ first_name: string | null; last_name: string | null; email: string }>('SELECT first_name, last_name, email FROM users WHERE id=$1', [userId]);
  const fullName = [userRows[0]?.first_name ?? '', userRows[0]?.last_name ?? ''].join(' ').trim() || userRows[0]?.email || 'User';
  const title = `${fullName}'s Bunzi Meal Planner AI`;

  const { rows: ins } = await query<{ id: string }>('INSERT INTO ai_sessions(user_id, persona, title) VALUES($1,$2,$3) RETURNING id', [userId, 'hybrid', title]);
  return ins[0].id;
}

export async function getSession(sessionId: string, userId: string) {
  const { rows } = await query<AISession>('SELECT * FROM ai_sessions WHERE id=$1 AND user_id=$2', [sessionId, userId]);
  return rows[0] || null;
}

// AI Messages
export async function listMessages(sessionId: string, limit: number = 50, offset: number = 0) {
  const { rows } = await query<AIMessage>('SELECT * FROM ai_messages WHERE session_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [sessionId, limit, offset]);
  return rows.reverse();
}

export async function appendMessage(
  sessionId: string,
  userId: string,
  role: 'user' | 'assistant' | 'system',
  content: any,
  artifactId?: string | null,
  tokenUsage?: number | null
) {
  await query(
    'INSERT INTO ai_messages(session_id, user_id, role, content, artifact_id, token_usage) VALUES($1,$2,$3,$4,$5,$6)',
    [sessionId, userId, role, content, artifactId ?? null, tokenUsage ?? null]
  );
}

// AI Usage Tracking
export async function getOrCreateCurrentUsage(userId: string) {
  const { start, end } = getCurrentPeriod();
  const { rows } = await query<AIUsage>(
    'SELECT * FROM ai_usage WHERE user_id=$1 AND period_start=$2 AND period_end=$3',
    [userId, start, end]
  );

  if (rows.length) return rows[0];

  const { rows: newRows } = await query<AIUsage>(
    'INSERT INTO ai_usage(user_id, period_start, period_end) VALUES($1,$2,$3) RETURNING *',
    [userId, start, end]
  );
  return newRows[0];
}

export async function incrementUsage(userId: string, tokens: number, sessionId?: string) {
  const { start, end } = getCurrentPeriod();
  const { rows } = await query<AIUsage>(
    'UPDATE ai_usage SET total_tokens_used = total_tokens_used + $1, updated_at = NOW() WHERE user_id=$2 AND period_start=$3 AND period_end=$4 RETURNING *',
    [tokens, userId, start, end]
  );
  if (!rows.length) {
    const { rows: insRows } = await query<AIUsage>(
      'INSERT INTO ai_usage(user_id, session_id, period_start, period_end, total_tokens_used) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [userId, sessionId || null, start, end, tokens]
    );
    return insRows[0];
  }
  return rows[0];
}

export async function getUsage(userId: string) {
  const { start, end } = getCurrentPeriod();
  const { rows } = await query<AIUsage>(
    'SELECT * FROM ai_usage WHERE user_id=$1 AND period_start=$2 AND period_end=$3',
    [userId, start, end]
  );
  return rows[0] || null;
}

// AI Artifacts
export async function createArtifact(userId: string, type: string, data: any) {
  const { rows } = await query<{ id: string }>('INSERT INTO ai_artifacts(user_id, type, data) VALUES($1,$2,$3) RETURNING id', [userId, type, data]);
  return rows[0].id;
}

export async function getArtifact(id: string, userId: string) {
  const { rows } = await query<AIArtifact>('SELECT * FROM ai_artifacts WHERE id=$1 AND user_id=$2', [id, userId]);
  return rows[0] || null;
}

// AI Memories
export async function getMemories(userId: string, kind: string) {
  const { rows } = await query<AIMemory>('SELECT * FROM ai_memories WHERE user_id=$1 AND kind=$2 ORDER BY updated_at DESC', [userId, kind]);
  return rows;
}

export async function createMemory(userId: string, kind: string, content: any) {
  await query('INSERT INTO ai_memories(user_id, kind, content) VALUES($1,$2,$3)', [userId, kind, content]);
}

export async function updateMemory(id: string, userId: string, content: any) {
  await query('UPDATE ai_memories SET content=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3', [content, id, userId]);
}
