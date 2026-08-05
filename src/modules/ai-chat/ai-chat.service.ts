import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';
import * as aiRepo from './ai-chat.repo.js';
import type { Persona } from './ai-chat.repo.js';
import { PERSONAS, PERSONA_TITLES } from './ai-chat.repo.js';
import * as nutritionRepo from '../nutrition/nutrition.repo.js';
import * as pantryRepo from '../pantry/pantry.repo.js';
import * as healthEngagementRepo from '../health-engagement/health-engagement.repo.js';
import * as usersRepo from '../users/users.repo.js';
import * as usersService from '../users/users.service.js';
import { replaceUserPlan } from '../nutrition/nutrition.repo.js';
import { replaceShoppingList } from '../shopping-list/shopping-list.repo.js';
import { geminiGenerate, geminiStream, GeminiUsage } from '../../utils/gemini.js';
import * as billingService from '../billing/billing.service.js';

export { PERSONAS, PERSONA_TITLES };
export type { Persona };

const FREE_TIER_TOKEN_LIMIT = 2000;

function buildSystemPrompt(fullName: string, persona: Persona, profile: any, preferences: any) {
  const personaPrompts: Record<Persona, string> = {
    dietitian: `
Role: Bunzi AI Dietitian — Warm, practical, and personalized dietitian.
Tone: Friendly, conversational, not too formal. Speak like a trusted advisor.
Goals: Help with meal planning, pantry use, budget-friendly ideas, and health-aware suggestions.
Style: Keep responses clear and actionable, use bullet points when helpful, ask questions to understand better.
`,
    nutritionist: `
Role: Bunzi AI Nutritionist — Evidence-based, detailed nutrition expert.
Tone: Professional but approachable, focus on facts without jargon.
Goals: Break down nutrition, help reach goals (weight, muscle, energy), explain why certain foods are good.
Style: Use specific numbers when helpful, prioritize user's health profile and goals.
`,
    chef: `
Role: Bunzi AI Chef — Creative, practical culinary expert.
Tone: Enthusiastic, encouraging, like a friendly chef friend.
Goals: Exciting recipe ideas, flavor combinations, smart substitutions, zero-waste cooking with pantry items.
Style: Make it delicious, practical, and fun to try!
`,
    'health-coach': `
Role: Bunzi AI Health Coach — Motivational, habit-focused wellness coach.
Tone: Upbeat, empathetic, accountability-driven but kind.
Goals: Build sustainable habits, stay consistent, mindset, energy, sleep and hydration nudges tied to food.
Style: Short wins, daily check-ins, celebrate progress, simple next steps, no guilt.
`
  };

  const basePrompt = `
BunziMeal AI for ${fullName}
${personaPrompts[persona]}
Context Rules:
- ALWAYS prioritize the user's allergies, dietary restrictions, and health goals first
- Use pantry items when possible to minimize waste and cost
- Mention local, seasonal produce appropriate to the user's location
- When suggesting recipes, link back to the user's meal plan if available
- Be conversational: ask questions if you need more info, give encouragement!
- Keep responses manageable (not too long unless asked for details)
- Don't give medical advice — if medical concerns, advise consulting a doctor
`;
  return basePrompt.trim();
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  GHS: '₵',
  USD: '$',
  GBP: '£',
  EUR: '€',
  KES: 'KSh',
  ZAR: 'R',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
  BRL: 'R$',
  MXN: 'Mex$',
  CLP: 'CLP$',
  COP: 'Col$',
  PEN: 'S/',
  ARS: 'Arg$',
  CHF: 'CHF',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  PLN: 'zł',
  CZK: 'Kč',
  HUF: 'Ft',
  RON: 'lei',
  TRY: '₺',
  RUB: '₽',
  UAH: '₴',
  THB: '฿',
  VND: '₫',
  IDR: 'Rp',
  MYR: 'RM',
  SGD: 'S$',
  HKD: 'HK$',
  TWD: 'NT$',
  KRW: '₩',
  PHP: '₱',
  PKR: 'Rs',
  BDT: '৳',
  LKR: 'Rs',
  NPR: 'Rs',
  AED: 'د.إ',
  SAR: '﷼',
  QAR: '﷼',
  EGP: '£',
  MAD: 'د.م.',
  DZD: 'د.ج',
  TND: 'د.ت',
  KWD: 'د.ك',
  BHD: 'ب.د',
  OMR: '﷼',
  JOD: 'د.ا',
  ILS: '₪',
  NZD: 'NZ$',
  UGX: 'USh',
  TZS: 'TSh',
  RWF: 'FRw',
  MWK: 'MK',
  ZMW: 'K',
  GMD: 'D',
  SLL: 'Le',
  GNF: 'FG',
  CVE: '$',
  ETB: 'Br',
  SDG: 'ج.س.',
  XAF: 'FCFA',
  XOF: 'CFA',
};

function currencySymbolForCode(code: string | null | undefined): string {
  if (!code) return '$';
  const up = String(code).toUpperCase();
  return CURRENCY_SYMBOLS[up] || up;
}

function getCurrencyInfo(userCountry: usersRepo.Country | null, profile: any, preferences: any) {
  const explicitPref = (preferences as any)?.currency || (profile as any)?.currency;
  if (explicitPref) {
    const code = String(explicitPref).toUpperCase();
    return { code, symbol: currencySymbolForCode(code) };
  }
  if (userCountry?.currency) {
    const code = String(userCountry.currency).toUpperCase();
    return { code, symbol: currencySymbolForCode(code) };
  }
  return { code: 'USD', symbol: '$' };
}

async function getUserIdentity(userId: string) {
  const basic = await usersRepo.getUserBasic(userId);
  return {
    first_name: basic?.first_name ?? null,
    last_name: basic?.last_name ?? null,
    email: basic?.email ?? 'user',
    country: basic?.country ?? null,
  };
}

async function loadProfileForContext(userId: string) {
  const { rows: profRows } = await query('SELECT * FROM profiles WHERE user_id=$1', [userId]);
  const profile = profRows[0] || {};
  const { rows: prefRows } = await query('SELECT * FROM user_preferences WHERE user_id=$1', [userId]);
  const preferences = prefRows[0] || {};
  return { profile, preferences };
}

function formatProfileForAI(profile: any, preferences: any, country: usersRepo.Country | null): string {
  const lines: string[] = [];

  lines.push('-- Personal Info --');
  if (profile.age != null) lines.push(`Age: ${profile.age}`);
  if (profile.gender) lines.push(`Gender: ${profile.gender}`);
  if (profile.height_cm != null) lines.push(`Height: ${profile.height_cm} cm`);
  if (profile.weight_kg != null) lines.push(`Weight: ${profile.weight_kg} kg`);
  if (profile.activity_level) lines.push(`Activity Level: ${profile.activity_level}`);
  if (country) lines.push(`Location: ${country.name} (${country.code}) — Currency: ${country.currency}`);

  lines.push('');
  lines.push('-- Health & Goals --');
  if (Array.isArray(profile.health_goals) && profile.health_goals.length) {
    lines.push(`Health Goals: ${profile.health_goals.join(', ')}`);
  }
  if (Array.isArray(profile.food_allergies) && profile.food_allergies.length) {
    lines.push(`Food Allergies: ${profile.food_allergies.join(', ')}`);
  }
  if (Array.isArray(profile.medical_dietary_restrictions) && profile.medical_dietary_restrictions.length) {
    lines.push(`Medical Dietary Restrictions: ${profile.medical_dietary_restrictions.join(', ')}`);
  }
  if (preferences.diet_type || profile.diet_type) {
    lines.push(`Diet Type: ${preferences.diet_type || profile.diet_type}`);
  }
  if (Array.isArray(preferences.allergens) && preferences.allergens.length) {
    lines.push(`Allergens (preferences): ${preferences.allergens.join(', ')}`);
  }

  lines.push('');
  lines.push('-- Taste & Cooking --');
  if (Array.isArray(profile.cuisine_preferences) && profile.cuisine_preferences.length) {
    lines.push(`Cuisine Preferences: ${profile.cuisine_preferences.join(', ')}`);
  }
  if (Array.isArray(profile.favorite_flavors) && profile.favorite_flavors.length) {
    lines.push(`Favorite Flavors: ${profile.favorite_flavors.join(', ')}`);
  }
  if (profile.heat_tolerance) lines.push(`Heat Tolerance: ${profile.heat_tolerance}`);
  if (Array.isArray(profile.foods_loved) && profile.foods_loved.length) {
    lines.push(`Foods Loved: ${profile.foods_loved.join(', ')}`);
  }
  if (Array.isArray(profile.foods_disliked) && profile.foods_disliked.length) {
    lines.push(`Foods Disliked: ${profile.foods_disliked.join(', ')}`);
  }
  if (Array.isArray(preferences.disliked_ingredients) && preferences.disliked_ingredients.length) {
    lines.push(`Disliked Ingredients (preferences): ${preferences.disliked_ingredients.join(', ')}`);
  }
  if (Array.isArray(preferences.liked_cuisines) && preferences.liked_cuisines.length) {
    lines.push(`Liked Cuisines (preferences): ${preferences.liked_cuisines.join(', ')}`);
  }
  if (profile.cooking_skill_level) lines.push(`Cooking Skill: ${profile.cooking_skill_level}`);
  if (profile.meal_prep_style) lines.push(`Meal Prep Style: ${profile.meal_prep_style}`);

  lines.push('');
  lines.push('-- Budget & Meals --');
  if (profile.budget_level) lines.push(`Budget Level: ${profile.budget_level}`);
  if (profile.meals_per_day != null) lines.push(`Meals Per Day: ${profile.meals_per_day}`);
  if (preferences.budget_per_week != null) lines.push(`Budget Per Week: ${preferences.budget_per_week}`);
  if (preferences.budget_per_meal != null) lines.push(`Budget Per Meal: ${preferences.budget_per_meal}`);
  if (preferences.preferred_prep_minutes != null) lines.push(`Preferred Prep Minutes: ${preferences.preferred_prep_minutes}`);
  if (profile.household_size) lines.push(`Household Size: ${profile.household_size}`);
  if (profile.shopping_frequency) lines.push(`Shopping Frequency: ${profile.shopping_frequency}`);
  if (Array.isArray(profile.kitchen_equipment_available) && profile.kitchen_equipment_available.length) {
    lines.push(`Kitchen Equipment: ${profile.kitchen_equipment_available.join(', ')}`);
  }
  if (profile.leftovers_preference) lines.push(`Leftovers Preference: ${profile.leftovers_preference}`);

  lines.push('');
  lines.push('-- Macros --');
  if (preferences.macro_calories != null) lines.push(`Target Calories: ${preferences.macro_calories} kcal`);
  if (preferences.macro_protein_g != null) lines.push(`Target Protein: ${preferences.macro_protein_g} g`);
  if (preferences.macro_carbs_g != null) lines.push(`Target Carbs: ${preferences.macro_carbs_g} g`);
  if (preferences.macro_fat_g != null) lines.push(`Target Fat: ${preferences.macro_fat_g} g`);

  return lines.join('\n');
}

async function loadRecipeCandidates(limit = 20) {
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

// Optimize context - keep only most relevant messages
function optimizeContext(messages: Array<{ role: string; content: string }>, maxTokens = 4000) {
  const optimized = [...messages];
  let total = 0;
  for (let i = optimized.length - 1; i >= 0; i--) {
    const msg = optimized[i];
    total += (msg.content?.length || 0) / 4; // rough estimate of tokens
    if (total > maxTokens && i > 2) { // keep system prompt and first few messages
      optimized.splice(i, 1);
    }
  }
  return optimized;
}

// Check usage limits
export async function checkUsageLimits(userId: string) {
  const billingStatus = await billingService.getStatus(userId);
  if (billingStatus.is_active) {
    return { allowed: true, remaining: Infinity };
  }
  
  const usage = await aiRepo.getUsage(userId);
  const used = usage?.total_tokens_used || 0;
  const remaining = FREE_TIER_TOKEN_LIMIT - used;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining), used };
}

export async function chatOnce(userId: string, prompt: string, persona: Persona = 'dietitian') {
  const usageCheck = await checkUsageLimits(userId);
  if (!usageCheck.allowed) {
    throw new Error('TOKEN_LIMIT_EXCEEDED');
  }

  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const userCountry = user.country;
  const { profile, preferences } = await loadProfileForContext(userId);
  const systemPrompt = buildSystemPrompt(fullName, persona, profile, preferences);

  const pantry = await pantryRepo.getPantryItemsForContext(userId);
  const recipes = await loadRecipeCandidates(15);
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const streak = await healthEngagementRepo.getUserStreak(userId);
  const stats = await usersService.computeStatsSummary(userId, 'today');

  const sessionId = await aiRepo.getOrCreatePersonaSession(userId, persona);
  const history = await aiRepo.listMessages(sessionId, 15);
  
  const userIdentityBlock = [
    `USER_IDENTITY:`,
    `Name: ${fullName}`,
    userCountry ? `Country: ${userCountry.name} (${userCountry.code})` : 'Country: Not set',
    userCountry ? `Currency: ${userCountry.currency}` : 'Currency: USD (default)',
  ].join('\n');

  const contextParts = [
    userIdentityBlock,
    `SYSTEM_PROFILE:\n${systemPrompt}`,
    `USER_PROFILE:\n${formatProfileForAI(profile, preferences, userCountry)}`,
    `PANTRY:\n${pantry.length ? pantry.join(', ') : 'No items in pantry'}`,
    `RECIPES_AVAILABLE:\n${JSON.stringify(recipes)}`,
    `HEALTH_GOALS:\n${JSON.stringify(rules)}`,
    `STREAK:\n${JSON.stringify(streak)}`,
    `TODAY_STATS:\n${JSON.stringify(stats)}`
  ];

  const { code, symbol } = getCurrencyInfo(userCountry, profile, preferences);
  const budgetPerMeal = (preferences as any)?.budget_per_meal ? Number((preferences as any).budget_per_meal) : null;
  if (budgetPerMeal != null && !Number.isNaN(budgetPerMeal)) {
    contextParts.push(`BUDGET_GUIDE:\nUser budget per meal ~ ${symbol}${budgetPerMeal} (${code}). Minimize waste, prioritize pantry and local seasonal produce${userCountry ? ` for ${userCountry.name}` : ''}.`);
  }

  // Build messages array with history
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  messages.push({ role: 'system', content: contextParts.join('\n\n') });
  
  for (const msg of history) {
    const content = typeof msg.content === 'string' ? msg.content : (msg.content?.text || '');
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content });
    }
  }
  messages.push({ role: 'user', content: prompt });
  
  const optimized = optimizeContext(messages);
  
  const response = await geminiGenerate(prompt, optimized.map(m => m.role + ':\n' + m.content));
  
  // Track usage
  const totalTokens = response.usage.totalTokens || 100;
  await aiRepo.incrementUsage(userId, totalTokens, sessionId);
  
  // Append messages to history
  await aiRepo.appendMessage(sessionId, userId, 'user', { text: prompt });
  await aiRepo.appendMessage(sessionId, userId, 'assistant', { text: response.text }, null, totalTokens);
  
  return { text: response.text, usage: response.usage };
}

export async function chatStream(userId: string, prompt: string, onDelta: (delta: string) => void, persona: Persona = 'dietitian') {
  const usageCheck = await checkUsageLimits(userId);
  if (!usageCheck.allowed) {
    throw new Error('TOKEN_LIMIT_EXCEEDED');
  }

  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const userCountry = user.country;
  const { profile, preferences } = await loadProfileForContext(userId);
  const systemPrompt = buildSystemPrompt(fullName, persona, profile, preferences);

  const pantry = await pantryRepo.getPantryItemsForContext(userId);
  const recipes = await loadRecipeCandidates(15);
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const streak = await healthEngagementRepo.getUserStreak(userId);
  const stats = await usersService.computeStatsSummary(userId, 'today');

  const sessionId = await aiRepo.getOrCreatePersonaSession(userId, persona);
  const history = await aiRepo.listMessages(sessionId, 15);
  
  const userIdentityBlock = [
    `USER_IDENTITY:`,
    `Name: ${fullName}`,
    userCountry ? `Country: ${userCountry.name} (${userCountry.code})` : 'Country: Not set',
    userCountry ? `Currency: ${userCountry.currency}` : 'Currency: USD (default)',
  ].join('\n');

  const contextParts = [
    userIdentityBlock,
    `SYSTEM_PROFILE:\n${systemPrompt}`,
    `USER_PROFILE:\n${formatProfileForAI(profile, preferences, userCountry)}`,
    `PANTRY:\n${pantry.length ? pantry.join(', ') : 'No items in pantry'}`,
    `RECIPES_AVAILABLE:\n${JSON.stringify(recipes)}`,
    `HEALTH_GOALS:\n${JSON.stringify(rules)}`,
    `STREAK:\n${JSON.stringify(streak)}`,
    `TODAY_STATS:\n${JSON.stringify(stats)}`
  ];

  const { code, symbol } = getCurrencyInfo(userCountry, profile, preferences);
  const budgetPerMeal = (preferences as any)?.budget_per_meal ? Number((preferences as any).budget_per_meal) : null;
  if (budgetPerMeal != null && !Number.isNaN(budgetPerMeal)) {
    contextParts.push(`BUDGET_GUIDE:\nUser budget per meal ~ ${symbol}${budgetPerMeal} (${code}). Minimize waste, prioritize pantry and local seasonal produce${userCountry ? ` for ${userCountry.name}` : ''}.`);
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  messages.push({ role: 'system', content: contextParts.join('\n\n') });
  
  for (const msg of history) {
    const content = typeof msg.content === 'string' ? msg.content : (msg.content?.text || '');
    if (msg.role === 'user' || msg.role === 'assistant') {
      messages.push({ role: msg.role, content });
    }
  }
  messages.push({ role: 'user', content: prompt });
  
  const optimized = optimizeContext(messages);
  
  const fullResponse = await geminiStream(
    prompt, 
    optimized.map(m => m.role + ':\n' + m.content),
    onDelta
  );
  
  const usage: GeminiUsage = fullResponse.usage.totalTokens
    ? fullResponse.usage
    : { totalTokens: Math.floor(fullResponse.text.length / 4) + 500 };
  await aiRepo.incrementUsage(userId, usage.totalTokens || 500, sessionId);
  
  await aiRepo.appendMessage(sessionId, userId, 'user', { text: prompt });
  await aiRepo.appendMessage(sessionId, userId, 'assistant', { text: fullResponse.text }, null, usage.totalTokens);
  
  return { text: fullResponse.text, usage };
}

export async function generatePlan(userId: string, req: { days?: number; mealsPerDay?: number; max_prep_minutes?: number; prompt?: string; budget?: any }) {
  const usageCheck = await checkUsageLimits(userId);
  if (!usageCheck.allowed) {
    throw new Error('TOKEN_LIMIT_EXCEEDED');
  }

  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const userCountry = user.country;
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const { profile, preferences } = await loadProfileForContext(userId);
  const pantry = await pantryRepo.getPantryItemsForContext(userId);
  const recipes = await loadRecipeCandidates(30);
  const { code, symbol } = getCurrencyInfo(userCountry, profile, preferences);

  const system = `Bunzi Meal Planner - Generate a personalized meal plan in JSON format.
User: ${fullName}
Country: ${userCountry ? `${userCountry.name} (${userCountry.code})` : 'Not set'}
Currency: ${code} (${symbol})
User Profile:
${formatProfileForAI(profile, preferences, userCountry)}

Rules: ${JSON.stringify(rules)}
Pantry: ${pantry.join(', ') || 'No items'}
Recipes: ${JSON.stringify(recipes)}
Budget: ${req.budget ? JSON.stringify(req.budget) : ((preferences as any).budget_per_meal != null ? `${symbol}${(preferences as any).budget_per_meal} per meal` : 'Not set')}
Max Prep Minutes: ${req.max_prep_minutes ?? (preferences as any).preferred_prep_minutes ?? 'No limit'}

Use local, seasonal produce appropriate for ${userCountry ? userCountry.name : 'the user\'s region'}.
Return ONLY valid JSON:
{
  "days": [
    { "day": 1, "day_name": "Monday", "meals": [{"slot": "breakfast", "name": "...", "recipe_title": "...", "recipe_id": null}] }
  ],
  "shopping_list": ["Tomatoes", "Onions"]
}

Also include legacy weekday keys (Monday-Sunday) for compatibility.`;

  const prompt = `${req.prompt || 'Generate a healthy meal plan for the week'}\nDays: ${req.days || 7}, Meals per day: ${req.mealsPerDay || 3}`;
  
  const sessionId = await aiRepo.getOrCreateSingleSession(userId);
  const response = await geminiGenerate(prompt, [system]);
  
  // Parse JSON from response
  let plan;
  try {
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      plan = JSON.parse(jsonMatch[0]);
    } else {
      // Fallback mock plan
      plan = {
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
    }
  } catch (e) {
    plan = {
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
  }

  // Add legacy weekday format
  for (let i = 0; i < 7; i++) {
    const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i];
    (plan as any)[dayName] = {
      breakfast: { name: 'Breakfast', recipe_title: 'Breakfast Recipe' },
      lunch: { name: 'Lunch', recipe_title: 'Lunch Recipe' },
      dinner: { name: 'Dinner', recipe_title: 'Dinner Recipe' }
    };
  }

  const usage = response.usage;
  await aiRepo.incrementUsage(userId, usage.totalTokens || 200, sessionId);
  
  const artifactId = await aiRepo.createArtifact(userId, 'meal_plan', plan);
  await replaceUserPlan(userId, plan);
  await replaceShoppingList(userId, plan.shopping_list || []);
  await aiRepo.appendMessage(sessionId, userId, 'assistant', { text: 'Meal plan generated successfully!' }, artifactId, usage.totalTokens || 200);

  return { plan, artifact_id: artifactId, usage };
}

export async function critiquePlan(userId: string, plan: any, persona: Persona = 'nutritionist') {
  const usageCheck = await checkUsageLimits(userId);
  if (!usageCheck.allowed) {
    throw new Error('TOKEN_LIMIT_EXCEEDED');
  }

  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const userCountry = user.country;
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const { profile, preferences } = await loadProfileForContext(userId);

  const system = `You are a helpful clinical nutritionist analyzing meal plans.
User: ${fullName}
Country: ${userCountry ? `${userCountry.name} (${userCountry.code})` : 'Not set'}
User Profile:
${formatProfileForAI(profile, preferences, userCountry)}

Health Goals/Rules: ${JSON.stringify(rules)}
Consider user's allergies, restrictions, health goals, budget, cooking skill, and activity level in your critique.

Return ONLY valid JSON: { "summary": "...", "faults": [{"day":1,"slot":"dinner","issue":"...","severity":"info","suggestion":"..."}] }`;

  const response = await geminiGenerate('Critique this meal plan', [system, JSON.stringify(plan)]);
  
  // Parse or fallback
  let critique;
  try {
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      critique = JSON.parse(jsonMatch[0]);
    } else {
      critique = {
        summary: 'Great plan! Good variety and generally balanced.',
        faults: [{
          day: 1,
          slot: 'dinner',
          issue: 'Consider adding more vegetables',
          severity: 'info' as const,
          suggestion: 'Add a side salad'
        }]
      };
    }
  } catch (e) {
    critique = {
      summary: 'Great plan! Good variety and generally balanced.',
      faults: [{
        day: 1,
        slot: 'dinner',
        issue: 'Consider adding more vegetables',
        severity: 'info' as const,
        suggestion: 'Add a side salad'
      }]
    };
  }
  
  const usage = response.usage;
  const sessionId = await aiRepo.getOrCreateSingleSession(userId);
  await aiRepo.incrementUsage(userId, usage.totalTokens || 150, sessionId);

  return { ...critique, usage };
}

export const getOrCreateSingleSession = aiRepo.getOrCreateSingleSession;
export const listMessages = aiRepo.listMessages;
export const appendMessage = aiRepo.appendMessage;
export const createArtifact = aiRepo.createArtifact;
export const getUsage = aiRepo.getUsage;
