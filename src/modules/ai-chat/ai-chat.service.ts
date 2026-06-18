import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';
import * as aiRepo from './ai-chat.repo.js';
import * as nutritionRepo from '../nutrition/nutrition.repo.js';
import * as pantryRepo from '../pantry/pantry.repo.js';
import * as healthEngagementRepo from '../health-engagement/health-engagement.repo.js';
import * as usersService from '../users/users.service.js';
import { replaceUserPlan } from '../nutrition/nutrition.repo.js';
import { replaceShoppingList } from '../shopping-list/shopping-list.repo.js';

type Persona = 'dietitian' | 'clinical-nutritionist';

function buildSystemPrompt(fullName: string, persona: Persona) {
  const prompts: Record<Persona, string[]> = {
    'dietitian': [
      `BunziMeal AI - Friendly Dietitian for ${fullName}`,
      "Role: A friendly, practical dietitian who helps with meal planning, recipe ideas, and pantry utilization. Keep responses conversational and actionable.",
      "Principles:",
      "- Always respect allergies and medical restrictions",
      "- Prioritize user goals, preferences, and budget",
      "- Suggest substitutions based on pantry items",
      "- Keep variety in meal plans",
      "- Provide safe, non-medical advice",
      "- Ask clarifying questions when needed"
    ],
    'clinical-nutritionist': [
      `BunziMeal AI - Clinical Nutritionist for ${fullName}`,
      "Role: A precise, evidence-based nutritionist focused on nutrient calculations, goal tracking, and health outcomes. Use specific numbers and science-backed recommendations.",
      "Principles:",
      "- Calculate exact macro and calorie targets",
      "- Track nutrient intake against goals",
      "- Emphasize evidence-based dietary guidelines",
      "- Be precise and analytical",
      "- Ask for specific health metrics when needed"
    ]
  };
  return prompts[persona].join('\n');
}

function getCurrencyInfo(profile: any, preferences: any) {
  const explicit = profile?.currency || preferences?.currency;
  const country = String(profile?.country || '').toLowerCase();
  const map: Record<string, { code: string; symbol: string }> = {
    ng: { code: 'NGN', symbol: '₦' },
    nigeria: { code: 'NGN', symbol: '₦' },
    gh: { code: 'GHS', symbol: '₵' },
    ghana: { code: 'GHS', symbol: '₵' },
    us: { code: 'USD', symbol: '$' },
    usa: { code: 'USD', symbol: '$' },
    unitedstates: { code: 'USD', symbol: '$' },
    uk: { code: 'GBP', symbol: '£' },
    unitedkingdom: { code: 'GBP', symbol: '£' },
    gb: { code: 'GBP', symbol: '£' },
    ke: { code: 'KES', symbol: 'KSh' },
    kenya: { code: 'KES', symbol: 'KSh' },
    za: { code: 'ZAR', symbol: 'R' },
    southafrica: { code: 'ZAR', symbol: 'R' },
    eu: { code: 'EUR', symbol: '€' },
    germany: { code: 'EUR', symbol: '€' },
    france: { code: 'EUR', symbol: '€' },
    spain: { code: 'EUR', symbol: '€' },
    italy: { code: 'EUR', symbol: '€' }
  };
  if (explicit) {
    const v = String(explicit).toUpperCase();
    if (v === 'NGN') return { code: 'NGN', symbol: '₦' };
    if (v === 'GHS') return { code: 'GHS', symbol: '₵' };
    if (v === 'GBP') return { code: 'GBP', symbol: '£' };
    if (v === 'EUR') return { code: 'EUR', symbol: '€' };
    if (v === 'KES') return { code: 'KES', symbol: 'KSh' };
    return { code: v, symbol: '$' };
  }
  const key = country.replace(/\s+/g, '');
  return map[key] || { code: 'USD', symbol: '$' };
}

async function getUserIdentity(userId: string): Promise<{ first_name: string | null; last_name: string | null; email: string }> {
  const { rows } = await query<{ first_name: string | null; last_name: string | null; email: string }>('SELECT first_name, last_name, email FROM users WHERE id=$1', [userId]);
  return rows[0] || { first_name: null, last_name: null, email: 'user' };
}

async function loadProfileForContext(userId: string) {
  const { rows: profRows } = await query('SELECT * FROM profiles WHERE user_id=$1', [userId]);
  const profile = profRows[0] || {};
  const { rows: prefRows } = await query('SELECT * FROM user_preferences WHERE user_id=$1', [userId]);
  const preferences = prefRows[0] || {};
  return { profile, preferences };
}

async function loadRecipeCandidates(limit = 50) {
  const { rows } = await query<{
    id: number;
    name: string;
    category: string;
    calories: number;
    protein_grams: number;
    carbs_grams: number;
    fat_grams: number;
  }>(
    `SELECT r.id, r.name, r.category,
            COALESCE(n.calories,0) as calories,
            COALESCE(n.protein_grams,0) as protein_grams,
            COALESCE(n.carbs_grams,0) as carbs_grams,
            COALESCE(n.fat_grams,0) as fat_grams
     FROM recipes r
     LEFT JOIN nutrition n ON n.recipe_id = r.id AND n.deleted_at IS NULL
     WHERE r.deleted_at IS NULL
     ORDER BY r.id DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

function mergeFacts(oldFacts: Array<{ key: string; value: string }>, newFacts: Array<{ key: string; value: string }>) {
  const map = new Map<string, string>();
  for (const f of oldFacts) map.set(f.key, f.value);
  for (const f of newFacts) map.set(f.key, f.value);
  return Array.from(map.entries()).map(([key, value]) => ({ key, value }));
}

export async function chatOnce(userId: string, prompt: string, persona: Persona = 'dietitian') {
  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const system = buildSystemPrompt(fullName, persona);
  const { profile, preferences } = await loadProfileForContext(userId);
  const pantry = await pantryRepo.getPantryItemsForContext(userId);
  const recipes = await loadRecipeCandidates(30);
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const streak = await healthEngagementRepo.getUserStreak(userId);
  const stats = await usersService.computeStatsSummary(userId, 'today');
  const ctx = [
    `SYSTEM:\n${system}`,
    `PROFILE:\n${JSON.stringify(profile)}`,
    `PREFERENCES:\n${JSON.stringify(preferences)}`,
    `PANTRY:\n${pantry.join(', ') || 'No items'}`,
    `RECIPES:\n${JSON.stringify(recipes)}`,
    `HEALTH_GOALS:\n${JSON.stringify(rules)}`,
    `STREAK:\n${JSON.stringify(streak)}`,
    `TODAY_STATS:\n${JSON.stringify(stats)}`,
    `FORMAT:\nRespond in clear conversational natural language. Do not return JSON unless explicitly asked.`
  ];

  const { code, symbol } = getCurrencyInfo(profile, preferences);
  ctx.push(`CURRENCY:\n${code}`);
  const budgetPerMeal = (preferences as any)?.budget_per_meal ? Number((preferences as any).budget_per_meal) : null;
  if (budgetPerMeal != null && !Number.isNaN(budgetPerMeal)) {
    ctx.push(`BUDGET_GUIDE:\nUser budget per meal ~ ${symbol}${budgetPerMeal} (${code}). Prioritize pantry, local produce, and minimize waste.`);
  }

  // For now, mock AI response
  // In real implementation, you'd call OpenAI/Gemini/Groq here
  const responseText = `I've received your message: "${prompt}". I'm using your profile, pantry items, and health goals to give personalized advice!`;
  const usage = { totalTokens: 100 };

  // Append to chat history
  const sessionId = await aiRepo.getOrCreateSingleSession(userId);
  await aiRepo.appendMessage(sessionId, userId, 'user', { text: prompt });
  await aiRepo.appendMessage(sessionId, userId, 'assistant', { text: responseText }, null, usage.totalTokens);

  return { text: responseText, usage };
}

export async function chatStream(userId: string, prompt: string, onDelta: (delta: string) => void, persona: Persona = 'dietitian') {
  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const system = buildSystemPrompt(fullName, persona);
  const { profile, preferences } = await loadProfileForContext(userId);
  const pantry = await pantryRepo.getPantryItemsForContext(userId);
  const recipes = await loadRecipeCandidates(30);
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const streak = await healthEngagementRepo.getUserStreak(userId);
  const stats = await usersService.computeStatsSummary(userId, 'today');

  const ctx = [
    `SYSTEM:\n${system}`,
    `PROFILE:\n${JSON.stringify(profile)}`,
    `PREFERENCES:\n${JSON.stringify(preferences)}`,
    `PANTRY:\n${pantry.join(', ') || 'No items'}`,
    `RECIPES:\n${JSON.stringify(recipes)}`,
    `HEALTH_GOALS:\n${JSON.stringify(rules)}`,
    `STREAK:\n${JSON.stringify(streak)}`,
    `TODAY_STATS:\n${JSON.stringify(stats)}`
  ];

  // Mock streaming response
  const responseText = `I've received your message: "${prompt}". I'm using your profile, pantry items, and health goals to give personalized advice!`;
  for (let i = 0; i < responseText.length; i++) {
    onDelta(responseText[i]);
    await new Promise(r => setTimeout(r, 10));
  }

  const usage = { totalTokens: 100 };
  const sessionId = await aiRepo.getOrCreateSingleSession(userId);
  await aiRepo.appendMessage(sessionId, userId, 'user', { text: prompt });
  await aiRepo.appendMessage(sessionId, userId, 'assistant', { text: responseText }, null, usage.totalTokens);

  return { text: responseText, usage };
}

export async function generatePlan(userId: string, req: { days?: number; mealsPerDay?: number; max_prep_minutes?: number; prompt?: string; budget?: any }) {
  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const system = buildSystemPrompt(fullName, 'dietitian');
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const { profile } = await loadProfileForContext(userId);
  const pantry = await pantryRepo.getPantryItemsForContext(userId);

  const ctx = [
    `SYSTEM:\n${system}`,
    `USER_GOALS:\n${JSON.stringify(rules)}`,
    `PROFILE:\n${JSON.stringify(profile)}`,
    `PANTRY:\n${pantry.join(', ') || 'No items'}`,
    `REQUEST_HINTS:\n${JSON.stringify(req)}`,
    `FORMAT:\nReturn ONLY strict JSON with: days array, shopping_list array. No prose.`
  ];

  // Mock plan generation
  const mockPlan = {
    days: Array.from({ length: req.days || 7 }, (_, i) => ({
      day: i + 1,
      day_name: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i % 7],
      meals: Array.from({ length: req.mealsPerDay || 3 }, (_, j) => ({
        slot: ['breakfast', 'lunch', 'dinner'][j],
        name: `${['Quick', 'Healthy', 'Delicious'][j]} Meal`,
        recipe_title: `${['Breakfast', 'Lunch', 'Dinner'][j]} Recipe`,
        recipe_id: null
      }))
    })),
    shopping_list: ['Tomatoes', 'Onions', 'Garlic']
  };

  // Also add the old weekday format for compatibility
  for (let i = 0; i < 7; i++) {
    const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i];
    (mockPlan as any)[dayName] = {
      breakfast: { name: 'Breakfast', recipe_title: 'Breakfast Recipe' },
      lunch: { name: 'Lunch', recipe_title: 'Lunch Recipe' },
      dinner: { name: 'Dinner', recipe_title: 'Dinner Recipe' }
    };
  }

  const usage = { totalTokens: 200 };
  const sessionId = await aiRepo.getOrCreateSingleSession(userId);
  const artifactId = await aiRepo.createArtifact(userId, 'meal_plan', mockPlan);
  await replaceUserPlan(userId, mockPlan);
  await replaceShoppingList(userId, mockPlan.shopping_list);
  await aiRepo.appendMessage(sessionId, userId, 'assistant', { text: 'Meal plan generated successfully!' }, artifactId, usage.totalTokens);

  return { plan: mockPlan, artifact_id: artifactId, usage };
}

export async function critiquePlan(userId: string, plan: any) {
  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const { profile } = await loadProfileForContext(userId);

  const ctx = [
    `SYSTEM:\nYou are BunziMeal AI, a clinical nutritionist analyzing meal plans for health safety and goal alignment.`,
    `USER_GOALS:\n${JSON.stringify(rules)}`,
    `PROFILE:\n${JSON.stringify(profile)}`,
    `PLAN:\n${JSON.stringify(plan)}`,
    `FORMAT:\nReturn ONLY strict JSON with: summary string, faults array`
  ];

  const mockCritique = {
    summary: 'Great plan! Good variety and generally balanced.',
    faults: [{
      day: 1,
      slot: 'dinner',
      issue: 'Consider adding more vegetables',
      severity: 'info' as const,
      suggestion: 'Add a side salad'
    }]
  };

  const usage = { totalTokens: 150 };
  return { ...mockCritique, usage };
}

export const getOrCreateSingleSession = aiRepo.getOrCreateSingleSession;
export const listMessages = aiRepo.listMessages;
export const appendMessage = aiRepo.appendMessage;
export const createArtifact = aiRepo.createArtifact;
