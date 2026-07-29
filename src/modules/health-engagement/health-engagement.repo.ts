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
  log_type: string;
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

export interface DailyCheckin {
  id: string;
  user_id: string;
  checkin_date: string;
  mood: number | null;
  energy: number | null;
  hunger: number | null;
  cravings: string | null;
  symptoms: string | null;
  bowel_movement: boolean;
  water_cups: number;
  steps_count: number;
  exercise_minutes: number;
  sleep_hours: number | null;
  weight: number | null;
  journal: string | null;
  gratitude: string[] | null;
  ai_tip: string | null;
  metadata: any | null;
  created_at: Date;
  updated_at: Date;
}

export interface HealthRecommendation {
  id: string;
  user_id: string;
  recommendation_type: 'daily_tip' | 'weekly_summary' | 'milestone_advice' | 'warning' | 'encouragement';
  title: string;
  content: string;
  category: string | null;
  priority: number;
  related_log_type: string | null;
  is_read: boolean;
  generated_at: Date;
  expires_at: Date | null;
  metadata: any | null;
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

export async function listHealthLogs(userId: string, from?: string, to?: string, logType?: string) {
  const params: any[] = [userId];
  const conditions: string[] = ['user_id=$1'];
  let i = 2;
  if (from) { conditions.push(`log_date >= $${i++}`); params.push(from); }
  if (to) { conditions.push(`log_date <= $${i++}`); params.push(to); }
  if (logType) { conditions.push(`log_type = $${i++}`); params.push(logType); }
  const { rows } = await query<HealthLog>(
    `SELECT * FROM health_logs WHERE ${conditions.join(' AND ')} ORDER BY log_date DESC, created_at DESC`,
    params
  );
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

export async function upsertCheckin(userId: string, data: Partial<Omit<DailyCheckin, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & { checkin_date: string }) {
  const fields = [
    'checkin_date', 'mood', 'energy', 'hunger', 'cravings', 'symptoms',
    'bowel_movement', 'water_cups', 'steps_count', 'exercise_minutes',
    'sleep_hours', 'weight', 'journal', 'gratitude', 'ai_tip', 'metadata'
  ];
  const cols: string[] = ['user_id'];
  const placeholders: string[] = ['$1'];
  const params: any[] = [userId];
  let i = 2;
  const updates: string[] = [];
  for (const f of fields) {
    if (f in data) {
      cols.push(f);
      const val = (data as any)[f];
      if (f === 'gratitude' && Array.isArray(val)) {
        placeholders.push(`$${i++}::text[]`);
        params.push(val);
      } else if (f === 'metadata' && val != null) {
        placeholders.push(`$${i++}::jsonb`);
        params.push(val);
      } else {
        placeholders.push(`$${i++}`);
        params.push(val);
      }
      if (f !== 'checkin_date') {
        if (f === 'gratitude') updates.push(`${f} = EXCLUDED.${f}`);
        else updates.push(`${f} = COALESCE(EXCLUDED.${f}, daily_checkins.${f})`);
      }
    }
  }
  const { rows } = await query<{ id: string }>(
    `INSERT INTO daily_checkins(${cols.join(', ')}) VALUES(${placeholders.join(', ')})
     ON CONFLICT (user_id, checkin_date) DO UPDATE SET
       ${updates.length ? updates.join(', ') + ',' : ''} updated_at = NOW()
     RETURNING id`,
    params
  );
  return getCheckinById(rows[0].id);
}

export async function getCheckinById(id: string): Promise<DailyCheckin | null> {
  const { rows } = await query<DailyCheckin>('SELECT * FROM daily_checkins WHERE id=$1', [id]);
  return rows[0] || null;
}

export async function getCheckinByDate(userId: string, date: string): Promise<DailyCheckin | null> {
  const { rows } = await query<DailyCheckin>('SELECT * FROM daily_checkins WHERE user_id=$1 AND checkin_date=$2', [userId, date]);
  return rows[0] || null;
}

export async function listCheckins(userId: string, from?: string, to?: string) {
  const params: any[] = [userId];
  const conditions: string[] = ['user_id=$1'];
  let i = 2;
  if (from) { conditions.push(`checkin_date >= $${i++}`); params.push(from); }
  if (to) { conditions.push(`checkin_date <= $${i++}`); params.push(to); }
  const { rows } = await query<DailyCheckin>(
    `SELECT * FROM daily_checkins WHERE ${conditions.join(' AND ')} ORDER BY checkin_date DESC`,
    params
  );
  return rows;
}

export async function getHealthSummary(userId: string, daysBack: number = 7) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack + 1);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = endDate.toISOString().slice(0, 10);

  const logs = await listHealthLogs(userId, startStr, endStr);
  const checkins = await listCheckins(userId, startStr, endStr);

  const types = ['weight', 'water', 'calories', 'protein', 'fat', 'carbs', 'sleep', 'steps', 'exercise', 'heart_rate', 'systolic_bp', 'diastolic_bp', 'mood', 'energy'];
  const series: Record<string, Array<{ date: string; value: number }>> = {};
  const aggregates: Record<string, { avg: number; min: number; max: number; sum: number; count: number; latest: number | null }> = {};

  for (const t of types) {
    series[t] = [];
    aggregates[t] = { avg: 0, min: Infinity, max: -Infinity, sum: 0, count: 0, latest: null };
  }

  for (const log of logs) {
    if (series[log.log_type]) {
      series[log.log_type].push({ date: log.log_date, value: Number(log.value) });
    }
    const agg = aggregates[log.log_type];
    if (agg) {
      const v = Number(log.value);
      agg.sum += v;
      agg.count += 1;
      if (v < agg.min) agg.min = v;
      if (v > agg.max) agg.max = v;
      agg.latest = v;
    }
  }

  for (const t of types) {
    const agg = aggregates[t];
    series[t].sort((a, b) => a.date.localeCompare(b.date));
    if (agg.count > 0) {
      agg.avg = agg.sum / agg.count;
      if (agg.min === Infinity) agg.min = agg.latest ?? 0;
      if (agg.max === -Infinity) agg.max = agg.latest ?? 0;
    } else {
      agg.min = 0;
      agg.max = 0;
    }
  }

  const checkinAgg = {
    avg_mood: 0, avg_energy: 0, avg_hunger: 0,
    avg_sleep_hours: 0, avg_water_cups: 0, avg_steps: 0, avg_exercise_min: 0,
    total_checkins: checkins.length
  };
  let mc = 0, ec = 0, hc = 0, sc = 0, wc = 0, stc = 0, exc = 0;
  for (const c of checkins) {
    if (c.mood != null) { checkinAgg.avg_mood += c.mood; mc++; }
    if (c.energy != null) { checkinAgg.avg_energy += c.energy; ec++; }
    if (c.hunger != null) { checkinAgg.avg_hunger += c.hunger; hc++; }
    if (c.sleep_hours != null) { checkinAgg.avg_sleep_hours += Number(c.sleep_hours); sc++; }
    checkinAgg.avg_water_cups += c.water_cups; wc++;
    checkinAgg.avg_steps += c.steps_count; stc++;
    checkinAgg.avg_exercise_min += c.exercise_minutes; exc++;
  }
  checkinAgg.avg_mood = mc ? checkinAgg.avg_mood / mc : 0;
  checkinAgg.avg_energy = ec ? checkinAgg.avg_energy / ec : 0;
  checkinAgg.avg_hunger = hc ? checkinAgg.avg_hunger / hc : 0;
  checkinAgg.avg_sleep_hours = sc ? checkinAgg.avg_sleep_hours / sc : 0;
  checkinAgg.avg_water_cups = wc ? checkinAgg.avg_water_cups / wc : 0;
  checkinAgg.avg_steps = stc ? Math.round(checkinAgg.avg_steps / stc) : 0;
  checkinAgg.avg_exercise_min = exc ? Math.round(checkinAgg.avg_exercise_min / exc) : 0;

  return {
    period: { days: daysBack, start: startStr, end: endStr },
    logs: aggregates,
    series,
    checkins: checkinAgg
  };
}

export async function listRecommendations(userId: string, unreadOnly = false, limit = 20) {
  const params: any[] = [userId];
  let i = 2;
  const where: string[] = ['user_id=$1'];
  if (unreadOnly) { where.push(`is_read = $${i++}`); params.push(false); }
  const { rows } = await query<HealthRecommendation>(
    `SELECT * FROM health_recommendations WHERE ${where.join(' AND ')} ORDER BY priority DESC, generated_at DESC LIMIT $${i++}`,
    [...params, limit]
  );
  return rows;
}

export async function createRecommendation(userId: string, data: Omit<HealthRecommendation, 'id' | 'user_id' | 'generated_at' | 'is_read'> & { is_read?: boolean }) {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO health_recommendations(user_id, recommendation_type, title, content, category, priority, related_log_type, is_read, expires_at, metadata)
     VALUES($1, $2, $3, $4, $5, $6, $7, COALESCE($8, FALSE), $9, $10) RETURNING id`,
    [userId, data.recommendation_type, data.title, data.content, data.category ?? null, data.priority ?? 0, data.related_log_type ?? null, data.is_read ?? false, data.expires_at ?? null, data.metadata ?? null]
  );
  const { rows: recs } = await query<HealthRecommendation>('SELECT * FROM health_recommendations WHERE id=$1', [rows[0].id]);
  return recs[0];
}

export async function markRecommendationsRead(userId: string, ids?: string[], all = false) {
  if (all) {
    await query('UPDATE health_recommendations SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE', [userId]);
  } else if (ids && ids.length) {
    await query('UPDATE health_recommendations SET is_read=TRUE WHERE user_id=$1 AND id = ANY($2)', [userId, ids]);
  }
}
