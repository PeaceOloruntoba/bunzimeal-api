import { query } from '../../db/pool.js';

export interface Violation {
  day: number;
  slot: string;
  recipe_id?: number | null;
  recipe_title?: string;
  reason: string;
  severity: string;
  suggestion?: string;
}

export interface GoalValidationRule {
  id: string;
  goal_key: string;
  rule_type: string;
  config: any;
  severity: 'info' | 'warning' | 'critical';
  created_at: Date;
}

export interface UserStreak {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_check_in_date: string | null;
  total_check_ins: number;
  streak_milestone_unlocked: string[];
  created_at: Date;
  updated_at: Date;
}

export interface HealthLog {
  id: string;
  user_id: string;
  log_date: string;
  log_type: 'weight' | 'water' | 'calories' | 'protein' | 'custom';
  value: number;
  unit: string;
  notes: string | null;
  metadata: any | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserPerk {
  id: string;
  user_id: string;
  perk_code: string;
  perk_name: string;
  perk_type: 'streak_milestone' | 'engagement_badge' | 'community_reward' | 'referral_bonus';
  perk_value: any | null;
  unlocked_at: Date;
  expires_at: Date | null;
  is_active: boolean;
  metadata: any | null;
  created_at: Date;
}

export async function getProfile(userId: string) {
  const { rows } = await query<{ health: any | null; preferences: any | null }>('SELECT health, preferences FROM profiles WHERE user_id=$1', [userId]);
  return rows[0] || null;
}

export async function upsertProfile(userId: string, patch: Record<string, any>) {
  await query('INSERT INTO profiles(user_id) VALUES($1) ON CONFLICT (user_id) DO NOTHING', [userId]);
  const keys = Object.keys(patch);
  if (!keys.length) return getProfile(userId);
  
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  
  for (const k of keys) {
    sets.push(`${k} = $${i++}`);
    params.push(patch[k]);
  }
  
  params.push(userId);
  await query(`UPDATE profiles SET ${sets.join(', ')}, updated_at=NOW() WHERE user_id=$${i}`, params);
  return getProfile(userId);
}

export async function listAvailableGoalKeys() {
  const { rows } = await query<{ goal_key: string }>('SELECT DISTINCT goal_key FROM goal_validation_rules ORDER BY goal_key ASC');
  return rows.map(r => r.goal_key);
}

export async function getUserStreak(userId: string): Promise<UserStreak | null> {
  const { rows } = await query<UserStreak>('SELECT * FROM user_streaks WHERE user_id=$1', [userId]);
  return rows[0] || null;
}

export async function upsertUserStreak(userId: string, data: Partial<Omit<UserStreak, 'id' | 'user_id' | 'created_at'>>) {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO user_streaks(user_id, current_streak, longest_streak, last_check_in_date, total_check_ins, streak_milestone_unlocked)
     VALUES($1, COALESCE($2, 0), COALESCE($3, 0), $4, COALESCE($5, 0), COALESCE($6, '{}'::text[]))
     ON CONFLICT (user_id)
     DO UPDATE SET
       current_streak = COALESCE(EXCLUDED.current_streak, user_streaks.current_streak),
       longest_streak = COALESCE(EXCLUDED.longest_streak, user_streaks.longest_streak),
       last_check_in_date = COALESCE(EXCLUDED.last_check_in_date, user_streaks.last_check_in_date),
       total_check_ins = COALESCE(EXCLUDED.total_check_ins, user_streaks.total_check_ins),
       streak_milestone_unlocked = COALESCE(EXCLUDED.streak_milestone_unlocked, user_streaks.streak_milestone_unlocked),
       updated_at = NOW()
     RETURNING id`,
    [userId, data.current_streak, data.longest_streak, data.last_check_in_date, data.total_check_ins, data.streak_milestone_unlocked]
  );
  return getUserStreak(userId);
}

export async function listHealthLogs(userId: string, from?: string, to?: string) {
  if (from && to) {
    const { rows } = await query<HealthLog>('SELECT * FROM health_logs WHERE user_id=$1 AND log_date BETWEEN $2 AND $3 ORDER BY log_date DESC', [userId, from, to]);
    return rows;
  }
  const { rows } = await query<HealthLog>('SELECT * FROM health_logs WHERE user_id=$1 ORDER BY log_date DESC', [userId]);
  return rows;
}

export async function getHealthLog(userId: string, id: string) {
  const { rows } = await query<HealthLog>('SELECT * FROM health_logs WHERE user_id=$1 AND id=$2', [userId, id]);
  return rows[0] || null;
}

export async function getHealthLogByDate(userId: string, logDate: string, logType: string) {
  const { rows } = await query<HealthLog>('SELECT * FROM health_logs WHERE user_id=$1 AND log_date=$2 AND log_type=$3', [userId, logDate, logType]);
  return rows[0] || null;
}

export async function createHealthLog(userId: string, data: Omit<HealthLog, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO health_logs(user_id, log_date, log_type, value, unit, notes, metadata)
     VALUES($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, log_date, log_type)
     DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, notes = EXCLUDED.notes, metadata = EXCLUDED.metadata, updated_at = NOW()
     RETURNING id`,
    [userId, data.log_date, data.log_type, data.value, data.unit, data.notes, data.metadata]
  );
  return getHealthLog(userId, rows[0].id);
}

export async function updateHealthLog(userId: string, id: string, data: Partial<Omit<HealthLog, 'id' | 'user_id' | 'log_date' | 'log_type' | 'created_at'>>) {
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  
  if (data.value !== undefined) { sets.push(`value=$${i++}`); params.push(data.value); }
  if (data.unit !== undefined) { sets.push(`unit=$${i++}`); params.push(data.unit); }
  if (data.notes !== undefined) { sets.push(`notes=$${i++}`); params.push(data.notes); }
  if (data.metadata !== undefined) { sets.push(`metadata=$${i++}`); params.push(data.metadata); }
  
  if (!sets.length) return getHealthLog(userId, id);
  
  params.push(id, userId);
  await query(`UPDATE health_logs SET ${sets.join(', ')}, updated_at=NOW() WHERE id=$${i++} AND user_id=$${i}`, params);
  return getHealthLog(userId, id);
}

export async function deleteHealthLog(userId: string, id: string) {
  await query('DELETE FROM health_logs WHERE user_id=$1 AND id=$2', [userId, id]);
}

export async function listUserPerks(userId: string) {
  const { rows } = await query<UserPerk>('SELECT * FROM user_perks WHERE user_id=$1 AND is_active=true ORDER BY unlocked_at DESC', [userId]);
  return rows;
}

export async function createUserPerk(userId: string, data: Omit<UserPerk, 'id' | 'user_id' | 'unlocked_at' | 'created_at' | 'is_active'>) {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO user_perks(user_id, perk_code, perk_name, perk_type, perk_value, expires_at, metadata)
     VALUES($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [userId, data.perk_code, data.perk_name, data.perk_type, data.perk_value, data.expires_at, data.metadata]
  );
  const { rows: perkRows } = await query<UserPerk>('SELECT * FROM user_perks WHERE id=$1', [rows[0].id]);
  return perkRows[0];
}

export async function loadRulesForUser(userId: string) {
  const profile = await getProfile(userId);
  const goals: string[] = [];
  if (profile) {
    const health = profile.health || {};
    const prefs = profile.preferences || {};
    if (Array.isArray(health.health_goals)) goals.push(...health.health_goals.map(String));
    if (prefs?.diet_type) goals.push(String(prefs.diet_type));
    if (Array.isArray(health.medical_dietary_restrictions)) goals.push(...health.medical_dietary_restrictions.map(String));
  }
  if (!goals.length) return [];
  const { rows } = await query<GoalValidationRule>('SELECT goal_key, rule_type, config, severity FROM goal_validation_rules WHERE goal_key = ANY($1)', [goals]);
  return rows;
}
