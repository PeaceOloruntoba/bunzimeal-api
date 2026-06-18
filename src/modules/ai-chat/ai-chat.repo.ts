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
