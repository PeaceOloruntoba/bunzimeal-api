import * as repo from './health-engagement.repo.js';
import type { Violation, HealthLog, DailyCheckin, UserStreak } from './health-engagement.repo.js';
import { openaiGenerate, hasOpenAi } from '../../utils/openai.js';

export async function getUserGoals(userId: string): Promise<string[]> {
  const profile = await repo.getProfile(userId);
  const health = (profile && (profile.health || {})) || {};
  if (Array.isArray(health.health_goals)) return health.health_goals.map(String);
  if (Array.isArray((profile && profile.preferences && (profile.preferences.goals || [])))) return (profile as any).preferences.goals.map(String);
  return [];
}

export async function setUserGoals(userId: string, goals: string[]) {
  const existingProfile = await repo.getProfile(userId);
  const existingHealth = existingProfile?.health || {};
  const patch = {
    health: { ...existingHealth, health_goals: goals }
  };
  return repo.upsertProfile(userId, patch);
}

export async function listAvailableGoalKeys() {
  return repo.listAvailableGoalKeys();
}

export async function checkAndUpdateStreak(userId: string, logDate: string) {
  let streak = await repo.getUserStreak(userId);
  const logDateStr = String(logDate).slice(0, 10);
  const today = new Date();
  const tzOffsetMs = today.getTimezoneOffset() * 60 * 1000;
  const todayStr = new Date(today.getTime() - tzOffsetMs).toISOString().slice(0, 10);

  const logDateNum = parseInt(logDateStr.replace(/-/g, ''), 10);
  const todayNum = parseInt(todayStr.replace(/-/g, ''), 10);
  const lastCheckInNum = streak?.last_check_in_date ? parseInt(String(streak.last_check_in_date).slice(0, 10).replace(/-/g, ''), 10) : null;

  function dateDiffDays(a: number, b: number): number {
    const ay = Math.floor(a / 10000);
    const am = Math.floor((a % 10000) / 100);
    const ad = a % 100;
    const by = Math.floor(b / 10000);
    const bm = Math.floor((b % 10000) / 100);
    const bd = b % 100;
    const da = new Date(ay, am - 1, ad);
    const db = new Date(by, bm - 1, bd);
    return Math.round((da.getTime() - db.getTime()) / 86400000);
  }

  if (!streak) {
    streak = await repo.upsertUserStreak(userId, {
      current_streak: 1,
      longest_streak: 1,
      last_check_in_date: logDateStr,
      total_check_ins: 1,
      streak_milestone_unlocked: []
    });
    return await repo.getUserStreak(userId);
  } else {
    let newCurrentStreak = streak.current_streak;
    let newLastCheckInDate = streak.last_check_in_date;
    let newTotalCheckIns = streak.total_check_ins;
    let newLongestStreak = streak.longest_streak;
    let newMilestones = [...(streak.streak_milestone_unlocked || [])];
    let updated = false;
    let incrementTotal = true;

    if (lastCheckInNum && logDateNum === lastCheckInNum) {
      return streak;
    } else if (lastCheckInNum && logDateNum < lastCheckInNum) {
      incrementTotal = false;
    } else if (lastCheckInNum) {
      const diff = dateDiffDays(logDateNum, lastCheckInNum);
      if (diff === 1) {
        newCurrentStreak = streak.current_streak + 1;
        newLastCheckInDate = logDateStr;
        if (newCurrentStreak > newLongestStreak) {
          newLongestStreak = newCurrentStreak;
        }
        updated = true;
      } else if (diff > 1) {
        newCurrentStreak = 1;
        newLastCheckInDate = logDateStr;
        updated = true;
      } else {
        incrementTotal = false;
      }
    } else {
      newCurrentStreak = 1;
      newLastCheckInDate = logDateStr;
      newLongestStreak = Math.max(newLongestStreak, 1);
      updated = true;
    }

    if (incrementTotal) {
      newTotalCheckIns = streak.total_check_ins + 1;
      updated = true;
    }

    if (!updated) {
      return streak;
    }

    const milestones = [7, 14, 30, 60, 90, 180, 365];
    const justUnlocked: string[] = [];
    for (const milestone of milestones) {
      if (newCurrentStreak >= milestone && !newMilestones.includes(`${milestone}-day-streak`)) {
        newMilestones.push(`${milestone}-day-streak`);
        justUnlocked.push(`${milestone}-day-streak`);
        await repo.createUserPerk(userId, {
          perk_code: `${milestone}-day-streak`,
          perk_name: `${milestone} Day Streak!`,
          perk_type: 'streak_milestone',
          perk_value: null,
          expires_at: null,
          metadata: null
        });
      }
    }

    const newStreak = await repo.upsertUserStreak(userId, {
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_check_in_date: newLastCheckInDate,
      total_check_ins: newTotalCheckIns,
      streak_milestone_unlocked: newMilestones
    });

    for (const m of justUnlocked) {
      const days = parseInt(m.split('-')[0], 10);
      await repo.createRecommendation(userId, {
        recommendation_type: 'milestone_advice',
        title: `🔥 ${days}-Day Streak Unlocked!`,
        content: `Incredible! You've been consistent for ${days} days straight. You're forming lifelong habits. Keep the momentum going—your future self will thank you. What's your next goal?`,
        category: 'milestone',
        priority: 100,
        related_log_type: null,
        expires_at: null,
        metadata: { milestone_days: days }
      });
    }

    return newStreak;
  }
}

function toLocalDateStr(d: Date = new Date()): string {
  const tz = d.getTimezoneOffset() * 60 * 1000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export async function logBulkEntries(userId: string, entries: Array<{ log_type: string; value: number; unit: string; notes?: string }>, logDate?: string) {
  const date = logDate || toLocalDateStr();
  const results: HealthLog[] = [];
  for (const e of entries) {
    const log = await repo.createHealthLog(userId, {
      log_date: date,
      log_type: e.log_type,
      value: e.value,
      unit: e.unit,
      notes: e.notes ?? null,
      metadata: null
    });
    if (log) results.push(log);
  }
  await checkAndUpdateStreak(userId, date);
  return results;
}

export async function saveCheckin(userId: string, data: Partial<Omit<DailyCheckin, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & { checkin_date?: string }) {
  const checkinDate = data.checkin_date || toLocalDateStr();
  const aiTip = data.ai_tip ?? null;
  const checkin = await repo.upsertCheckin(userId, { ...data, checkin_date: checkinDate, ai_tip: aiTip });

  if (checkin) {
    await checkAndUpdateStreak(userId, checkinDate);
    const streak = await repo.getUserStreak(userId);

    if (streak && streak.current_streak > 0 && streak.current_streak % 3 === 0) {
      const tip = await generateDailyTip(userId, { streak, checkin });
      if (tip) {
        await repo.upsertCheckin(userId, { checkin_date: checkinDate, ai_tip: tip });
      }
    }
  }

  return checkin;
}

export async function generateDailyTip(
  userId: string,
  context?: { streak?: UserStreak | null; checkin?: DailyCheckin | null; recentLogs?: HealthLog[] }
): Promise<string | null> {
  if (!hasOpenAi) return fallbackDailyTip(userId, context?.streak);

  const goals = await getUserGoals(userId);
  const recent = context?.recentLogs ?? await repo.listHealthLogs(userId,
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const streak = context?.streak;
  const checkin = context?.checkin;

  const ctxParts: string[] = [];
  ctxParts.push(`You are Bunzi, a warm, encouraging health companion for a meal planning app. Tone: friendly, concise, actionable, always positive.`);
  if (goals.length) ctxParts.push(`User health goals: ${goals.join(', ')}.`);
  if (streak) ctxParts.push(`User streak: ${streak.current_streak} days (longest ${streak.longest_streak}). Total check-ins: ${streak.total_check_ins}.`);
  if (checkin) {
    const parts: string[] = [];
    if (checkin.mood != null) parts.push(`mood ${checkin.mood}/5`);
    if (checkin.energy != null) parts.push(`energy ${checkin.energy}/5`);
    if (checkin.sleep_hours != null) parts.push(`sleep ${checkin.sleep_hours}h`);
    if (checkin.water_cups != null) parts.push(`water ${checkin.water_cups} cups`);
    if (checkin.steps_count != null) parts.push(`steps ${checkin.steps_count}`);
    if (checkin.exercise_minutes != null) parts.push(`exercise ${checkin.exercise_minutes} min`);
    if (checkin.cravings) parts.push(`cravings: ${checkin.cravings}`);
    if (checkin.symptoms) parts.push(`symptoms: ${checkin.symptoms}`);
    if (parts.length) ctxParts.push(`Today's check-in: ${parts.join('; ')}.`);
  }
  if (recent.length) {
    const sample = recent.slice(0, 14).map(l => `${l.log_date} ${l.log_type}=${l.value}${l.unit}`).join('; ');
    ctxParts.push(`Recent health logs: ${sample}`);
  }

  try {
    const prompt = `Give the user ONE short, uplifting health tip (max 120 characters) with 1 tiny specific action they can take today. Make it personal based on the context.`;
    const { text } = await openaiGenerate(prompt, ctxParts, 'gpt-4o-mini');
    return text.trim().slice(0, 500);
  } catch {
    return fallbackDailyTip(userId, streak);
  }
}

function fallbackDailyTip(userId: string, streak?: UserStreak | null): string {
  const tips = [
    'Drink a tall glass of water first thing—it kickstarts metabolism! 💧',
    'Add 10 minutes of walking after lunch; digestion and mood will thank you.',
    'Fill half your plate with veggies before anything else. Simple win.',
    'Take 3 deep breaths right now. Stress kills progress—you got this.',
    'Skip sugary drinks today. Opt for herbal tea or infused water.',
    'Stand up and stretch for 1 minute every hour you sit.',
    'Choose whole grains over refined. Steady energy, no crash.',
    'Grab a fruit instead of packaged snacks. Nature\'s candy.',
    'Get 7-8 hours sleep. Recovery is where the magic happens.🌙',
    'Chew slowly. It takes 20 mins for the brain to feel full.',
  ];
  const idx = Math.min(tips.length - 1, (streak?.current_streak ?? 0) % tips.length);
  return tips[idx];
}

export async function generateHealthInsights(userId: string, periodDays: number = 7) {
  const summary = await repo.getHealthSummary(userId, periodDays);
  const goals = await getUserGoals(userId);
  const streak = await repo.getUserStreak(userId);
  const checkins = summary.checkins;
  const logs = summary.logs;

  const warnings: Array<{ type: string; title: string; content: string; severity: 'low' | 'medium' | 'high' }> = [];
  const encouragements: Array<{ type: string; title: string; content: string }> = [];

  if (logs.water.count > 0 && logs.water.avg < 6) {
    warnings.push({
      type: 'hydration', severity: 'medium',
      title: 'Stay Hydrated 💧',
      content: `Your average water intake is ${Math.round(logs.water.avg)} cups/day. Aim for 8 cups to keep energy up and digestion smooth.`
    });
  }
  if (checkins.total_checkins > 0 && checkins.avg_sleep_hours && checkins.avg_sleep_hours < 6.5) {
    warnings.push({
      type: 'sleep', severity: 'high',
      title: 'Sleep is Low',
      content: `Average ${checkins.avg_sleep_hours.toFixed(1)}h/night. Aim for 7-8h. Poor sleep derails metabolism and willpower.`
    });
  }
  if (checkins.total_checkins > 0 && checkins.avg_steps && checkins.avg_steps < 5000) {
    warnings.push({
      type: 'activity', severity: 'low',
      title: 'Steps Could Improve',
      content: `Average ${checkins.avg_steps} steps/day. Try 2 short walks to reach 7k+. Small steps, big results.`
    });
  }
  if (logs.weight.count > 1) {
    const arr = summary.series.weight;
    if (arr.length >= 2) {
      const first = arr[0].value;
      const last = arr[arr.length - 1].value;
      const diff = last - first;
      if (goals.includes('lose_weight') && diff > 0) {
        warnings.push({
          type: 'weight', severity: 'medium',
          title: 'Weight Trending Up',
          content: `Weight went from ${first} to ${last}. Stay consistent with meal plans and water. Small deficits add up!`
        });
      } else if (goals.includes('lose_weight') && diff < -0.5) {
        encouragements.push({
          type: 'weight',
          title: '🎉 Progress!',
          content: `You dropped ${Math.abs(diff).toFixed(1)} units this period. Keep going—momentum is on your side!`
        });
      } else if (goals.includes('gain_muscle') && diff > 0.3) {
        encouragements.push({
          type: 'weight',
          title: '💪 Gains Noticed',
          content: `Weight up by ${diff.toFixed(1)}. Protein intake and training are paying off!`
        });
      }
    }
  }
  if (logs.exercise.count > 0 && logs.exercise.avg >= 30) {
    encouragements.push({
      type: 'exercise',
      title: '💪 Exercise Consistency',
      content: `Averaging ~${Math.round(logs.exercise.avg)} min/day. Consistency beats intensity. Keep showing up!`
    });
  }
  if (logs.protein.count > 0 && logs.protein.avg >= 80) {
    encouragements.push({
      type: 'nutrition',
      title: '🥩 Protein On Point',
      content: `Averaging ${Math.round(logs.protein.avg)}g protein/day. Muscle repair, satiety, metabolism—all covered.`
    });
  }
  if (streak && streak.current_streak >= 5) {
    encouragements.push({
      type: 'streak',
      title: `🔥 ${streak.current_streak} Day Streak`,
      content: `Discipline is compounding. You're not missing days, and that's what separates winners.`
    });
  }

  const unread = await repo.listRecommendations(userId, true, 5);

  return {
    summary,
    goals,
    streak,
    warnings,
    encouragements,
    tips: unread,
    ai_advice: null as string | null
  };
}

export async function getAiAdvice(userId: string): Promise<string | null> {
  if (!hasOpenAi) {
    const s = await repo.getUserStreak(userId);
    return `Hey! Let's keep building momentum. You're at ${s?.current_streak ?? 0} days—small daily actions create huge results. Ready to log today's progress?`;
  }
  const insights = await generateHealthInsights(userId, 7);
  const ctx: string[] = [];
  ctx.push(`You are Bunzi, a personal health companion. Warm, supportive, concise, specific. 180 words max.`);
  if (insights.goals.length) ctx.push(`Goals: ${insights.goals.join(', ')}.`);
  ctx.push(`Period averages: Water ${Math.round(insights.summary.logs.water.avg)} cups, Protein ${Math.round(insights.summary.logs.protein.avg)}g, Calories ${Math.round(insights.summary.logs.calories.avg)}, Sleep ${insights.summary.checkins.avg_sleep_hours.toFixed(1)}h, Steps ${insights.summary.checkins.avg_steps}, Exercise ${insights.summary.checkins.avg_exercise_min} min. Streak: ${insights.streak?.current_streak ?? 0}d.`);
  if (insights.warnings.length) ctx.push(`Warnings flagged: ${insights.warnings.map(w => `${w.title} - ${w.content}`).join(' | ')}`);
  if (insights.encouragements.length) ctx.push(`Wins: ${insights.encouragements.map(e => e.title).join('; ')}.`);

  try {
    const prompt = `Write a personalized daily message. Start with their name using a fun warm greeting. Celebrate any wins, kindly highlight 1-2 areas of opportunity with specific actions, and finish with motivation. Use emojis naturally.`;
    const { text } = await openaiGenerate(prompt, ctx, 'gpt-4o-mini');
    return text.trim();
  } catch (e) {
    return `Let's keep going! Every log is a vote for the healthier version of yourself. 🌱`;
  }
}

export async function seedDailyTipIfEmpty(userId: string) {
  const today = toLocalDateStr();
  const allRecent = await repo.listRecommendations(userId, false, 20);
  const hasTip = allRecent.some(r => {
    if (r.recommendation_type !== 'daily_tip') return false;
    const genDay = toLocalDateStr(new Date(r.generated_at));
    return genDay === today;
  });
  if (hasTip) return;
  const tip = await generateDailyTip(userId);
  if (tip) {
    await repo.createRecommendation(userId, {
      recommendation_type: 'daily_tip',
      title: 'Today\'s Bunzi Tip',
      content: tip,
      category: 'daily',
      priority: 50,
      related_log_type: null,
      expires_at: null,
      metadata: null
    });
  }
}

function containsKeyword(name: string, keywords: string[]) {
  const n = String(name || '').toLowerCase();
  for (const k of keywords) {
    if (k && n.includes(String(k).toLowerCase())) {
      return String(k);
    }
  }
  return null;
}

export async function validatePlanAgainstUserGoals(userId: string, plan: any): Promise<{ valid: boolean; violations: Violation[] }> {
  const rules = await repo.loadRulesForUser(userId);
  const violations: Violation[] = [];
  if (!plan || !Array.isArray(plan.days)) return { valid: true, violations };

  for (let d = 0; d < plan.days.length; d++) {
    const day = plan.days[d];
    for (const m of (day.meals || [])) {
      const title = String(m.name || m.recipe_title || '');
      for (const r of rules) {
        if (r.rule_type === 'forbidden_keyword') {
          const keywords: string[] = (r.config && r.config.keywords) || [];
          const found = containsKeyword(title, keywords);
          if (found) {
            const suggestion = (r.config && r.config.substitutes && r.config.substitutes[found]) || null;
            violations.push({
              day: d + 1,
              slot: m.slot || 'meal',
              recipe_id: m.recipe_id || null,
              recipe_title: title,
              reason: `Contains forbidden term: ${found} for goal ${r.goal_key}`,
              severity: r.severity || 'warning',
              suggestion: suggestion || undefined
            });
          }
        }
        if (r.rule_type === 'max_nutrient_per_meal') {
          const nut = r.config && r.config.nutrient;
          const max = Number(r.config && r.config.max || 0);
          if (nut && max) {
            const val = Number(m[nut] ?? m[`${nut}`] ?? 0);
            if (!Number.isNaN(val) && val > max) {
              violations.push({
                day: d + 1,
                slot: m.slot || 'meal',
                recipe_id: m.recipe_id || null,
                recipe_title: title,
                reason: `${nut} (${val}) exceeds max ${max}`,
                severity: r.severity || 'critical'
              });
            }
          }
        }
      }
    }
  }
  return { valid: violations.length === 0, violations };
}

export async function applyAutoFixes(plan: any, violations: Violation[]) {
  if (!plan || !Array.isArray(plan.days)) return { plan, fixed: 0 };
  let fixed = 0;
  for (const v of violations) {
    if (!v.suggestion) continue;
    const dayIdx = v.day - 1;
    const day = plan.days[dayIdx];
    if (!day) continue;
    const meal = (day.meals || []).find((m: any) =>
      (String(m.recipe_id || m.recipe_title || '') === String(v.recipe_id || v.recipe_title || '')) ||
      (m.slot || '') === v.slot
    );
    if (!meal) continue;
    meal.name = v.suggestion;
    meal.recipe_title = v.suggestion;
    fixed++;
  }
  return { plan, fixed };
}

export async function checkEngagementBadges(userId: string) {
  const checkins = await repo.listCheckins(userId,
    new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const logs = await repo.listHealthLogs(userId,
    new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const perks = await repo.listUserPerks(userId);
  const perkCodes = new Set(perks.map(p => p.perk_code));
  const newlyAdded: string[] = [];

  if (checkins.length >= 20 && !perkCodes.has('monthly-checkin')) {
    await repo.createUserPerk(userId, {
      perk_code: 'monthly-checkin', perk_name: 'Consistent Tracker',
      perk_type: 'engagement_badge', perk_value: null, expires_at: null, metadata: null
    });
    newlyAdded.push('Consistent Tracker');
  }
  const waterLogs = logs.filter(l => l.log_type === 'water' && l.value >= 8);
  if (waterLogs.length >= 5 && !perkCodes.has('water-champion')) {
    await repo.createUserPerk(userId, {
      perk_code: 'water-champion', perk_name: 'Water Champion 💧',
      perk_type: 'engagement_badge', perk_value: null, expires_at: null, metadata: null
    });
    newlyAdded.push('Water Champion');
  }
  const exerLogs = logs.filter(l => l.log_type === 'exercise' && l.value >= 30);
  if (exerLogs.length >= 4 && !perkCodes.has('sweat-session')) {
    await repo.createUserPerk(userId, {
      perk_code: 'sweat-session', perk_name: 'Sweat Sessions 🔥',
      perk_type: 'engagement_badge', perk_value: null, expires_at: null, metadata: null
    });
    newlyAdded.push('Sweat Sessions');
  }
  if (logs.length >= 20 && !perkCodes.has('data-lover')) {
    await repo.createUserPerk(userId, {
      perk_code: 'data-lover', perk_name: 'Data Lover 📊',
      perk_type: 'engagement_badge', perk_value: null, expires_at: null, metadata: null
    });
    newlyAdded.push('Data Lover');
  }

  for (const badge of newlyAdded) {
    await repo.createRecommendation(userId, {
      recommendation_type: 'encouragement',
      title: `🏅 Badge Earned: ${badge}`,
      content: `You just unlocked the "${badge}" badge! Keep collecting them to show your health journey pride.`,
      category: 'badge', priority: 80, related_log_type: null,
      expires_at: null,
      metadata: null
    });
  }

  return newlyAdded;
}
