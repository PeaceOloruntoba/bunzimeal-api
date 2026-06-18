import * as repo from './health-engagement.repo.js';
import type { Violation } from './health-engagement.repo.js';

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
  const today = new Date().toISOString().slice(0, 10);
  const logDateObj = new Date(logDate);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  if (!streak) {
    streak = await repo.upsertUserStreak(userId, {
      current_streak: 1,
      longest_streak: 1,
      last_check_in_date: logDate,
      total_check_ins: 1,
      streak_milestone_unlocked: []
    });
    return await repo.getUserStreak(userId);
  } else {
    let newCurrentStreak = streak.current_streak;
    let newLastCheckInDate = streak.last_check_in_date;
    let newTotalCheckIns = streak.total_check_ins + 1;
    let newLongestStreak = streak.longest_streak;
    let newMilestones = [...(streak.streak_milestone_unlocked || [])];

    if (streak.last_check_in_date === logDate) {
      return streak;
    } else if (streak.last_check_in_date === yesterdayStr) {
      newCurrentStreak = streak.current_streak + 1;
      newLastCheckInDate = logDate;
      if (newCurrentStreak > newLongestStreak) {
        newLongestStreak = newCurrentStreak;
      }
    } else {
      newCurrentStreak = 1;
      newLastCheckInDate = logDate;
    }

    const milestones = [7, 14, 30, 60, 90, 180, 365];
    for (const milestone of milestones) {
      if (newCurrentStreak >= milestone && !newMilestones.includes(`${milestone}-day-streak`)) {
        newMilestones.push(`${milestone}-day-streak`);
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

    return await repo.upsertUserStreak(userId, {
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_check_in_date: newLastCheckInDate,
      total_check_ins: newTotalCheckIns,
      streak_milestone_unlocked: newMilestones
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
