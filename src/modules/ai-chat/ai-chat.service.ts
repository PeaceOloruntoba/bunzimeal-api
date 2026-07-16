import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';
import * as aiRepo from './ai-chat.repo.js';
import * as nutritionRepo from '../nutrition/nutrition.repo.js';
import * as pantryRepo from '../pantry/pantry.repo.js';
import * as healthEngagementRepo from '../health-engagement/health-engagement.repo.js';
import * as usersService from '../users/users.service.js';
import { replaceUserPlan } from '../nutrition/nutrition.repo.js';
import { replaceShoppingList } from '../shopping-list/shopping-list.repo.js';
import { openaiGenerate, openaiStream, OpenAIUsage } from '../../utils/openai.js';
import * as billingService from '../billing/billing.service.js';

const FREE_TIER_TOKEN_LIMIT = 2000; // 2000 tokens free/month
type Persona = 'dietitian' | 'nutritionist' | 'chef';

function buildSystemPrompt(fullName: string, persona: Persona, profile: any, preferences: any) {
  const personaPrompts: Record<Persona, string> = {
    dietitian: `
Role: Bunzi AI Dietitian - Warm, practical, and personalized dietitian.
Tone: Friendly, conversational, not too formal. Speak like a trusted advisor.
Goals: Help with meal planning, pantry use, budget-friendly ideas, and health-aware suggestions.
Style: Keep responses clear and actionable, use bullet points when helpful, ask questions to understand better.
`,
    nutritionist: `
Role: Bunzi AI Nutritionist - Evidence-based, detailed nutrition expert.
Tone: Professional but approachable, focus on facts without jargon.
Goals: Break down nutrition, help reach goals (weight, muscle, energy), explain why certain foods are good.
Style: Use specific numbers when helpful, prioritize user's health profile and goals.
`,
    chef: `
Role: Bunzi AI Chef - Creative, practical culinary expert.
Tone: Enthusiastic, encouraging, like a friendly chef friend.
Goals: Exciting recipe ideas, flavor combinations, smart substitutions, zero-waste cooking with pantry items.
Style: Make it delicious, practical, and fun to try!
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
- Don't give medical advice - if medical concerns, advise consulting a doctor
`;
  return basePrompt.trim();
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
  // Check usage limits first
  const usageCheck = await checkUsageLimits(userId);
  if (!usageCheck.allowed) {
    throw new Error('TOKEN_LIMIT_EXCEEDED');
  }

  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const { profile, preferences } = await loadProfileForContext(userId);
  const systemPrompt = buildSystemPrompt(fullName, persona, profile, preferences);
  
  const pantry = await pantryRepo.getPantryItemsForContext(userId);
  const recipes = await loadRecipeCandidates(15);
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const streak = await healthEngagementRepo.getUserStreak(userId);
  const stats = await usersService.computeStatsSummary(userId, 'today');
  
  // Load chat history for context
  const sessionId = await aiRepo.getOrCreateSingleSession(userId);
  const history = await aiRepo.listMessages(sessionId, 15);
  
  const contextParts = [
    `USER_IDENTITY: Name - ${fullName}`,
    `SYSTEM_PROFILE:\n${systemPrompt}`,
    `PROFILE:\n${JSON.stringify(profile)}`,
    `PREFERENCES:\n${JSON.stringify(preferences)}`,
    `PANTRY:\n${pantry.length ? pantry.join(', ') : 'No items in pantry'}`,
    `RECIPES_AVAILABLE:\n${JSON.stringify(recipes)}`,
    `HEALTH_GOALS:\n${JSON.stringify(rules)}`,
    `STREAK:\n${JSON.stringify(streak)}`,
    `TODAY_STATS:\n${JSON.stringify(stats)}`
  ];

  const { code, symbol } = getCurrencyInfo(profile, preferences);
  const budgetPerMeal = (preferences as any)?.budget_per_meal ? Number((preferences as any).budget_per_meal) : null;
  if (budgetPerMeal != null && !Number.isNaN(budgetPerMeal)) {
    contextParts.push(`BUDGET_GUIDE:\nUser budget per meal ~ ${symbol}${budgetPerMeal} (${code}). Minimize waste, prioritize pantry and local options.`);
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
  
  // Call OpenAI
  const response = await openaiGenerate(prompt, optimized.map(m => m.role + ':\n' + m.content));
  
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
  const { profile, preferences } = await loadProfileForContext(userId);
  const systemPrompt = buildSystemPrompt(fullName, persona, profile, preferences);
  
  const pantry = await pantryRepo.getPantryItemsForContext(userId);
  const recipes = await loadRecipeCandidates(15);
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const streak = await healthEngagementRepo.getUserStreak(userId);
  const stats = await usersService.computeStatsSummary(userId, 'today');
  
  const sessionId = await aiRepo.getOrCreateSingleSession(userId);
  const history = await aiRepo.listMessages(sessionId, 15);
  
  const contextParts = [
    `USER_IDENTITY: Name - ${fullName}`,
    `SYSTEM_PROFILE:\n${systemPrompt}`,
    `PROFILE:\n${JSON.stringify(profile)}`,
    `PREFERENCES:\n${JSON.stringify(preferences)}`,
    `PANTRY:\n${pantry.length ? pantry.join(', ') : 'No items in pantry'}`,
    `RECIPES_AVAILABLE:\n${JSON.stringify(recipes)}`,
    `HEALTH_GOALS:\n${JSON.stringify(rules)}`,
    `STREAK:\n${JSON.stringify(streak)}`,
    `TODAY_STATS:\n${JSON.stringify(stats)}`
  ];

  const { code, symbol } = getCurrencyInfo(profile, preferences);
  const budgetPerMeal = (preferences as any)?.budget_per_meal ? Number((preferences as any).budget_per_meal) : null;
  if (budgetPerMeal != null && !Number.isNaN(budgetPerMeal)) {
    contextParts.push(`BUDGET_GUIDE:\nUser budget per meal ~ ${symbol}${budgetPerMeal} (${code}). Minimize waste, prioritize pantry and local options.`);
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
  
  const fullResponse = await openaiStream(
    prompt, 
    optimized.map(m => m.role + ':\n' + m.content),
    onDelta
  );
  
  // Approximate usage for streaming
  const usage: OpenAIUsage = { totalTokens: Math.floor(fullResponse.text.length / 4) + 500 };
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
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const { profile } = await loadProfileForContext(userId);
  const pantry = await pantryRepo.getPantryItemsForContext(userId);
  const recipes = await loadRecipeCandidates(30);

  const system = `Bunzi Meal Planner - Generate a personalized meal plan in JSON format.
User: ${fullName}
Rules: ${JSON.stringify(rules)}
Pantry: ${pantry.join(', ') || 'No items'}
Recipes: ${JSON.stringify(recipes)}

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
  const response = await openaiGenerate(prompt, [system]);
  
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

export async function critiquePlan(userId: string, plan: any) {
  const usageCheck = await checkUsageLimits(userId);
  if (!usageCheck.allowed) {
    throw new Error('TOKEN_LIMIT_EXCEEDED');
  }

  const user = await getUserIdentity(userId);
  const fullName = [user?.first_name ?? '', user?.last_name ?? ''].join(' ').trim() || user.email;
  const rules = await healthEngagementRepo.loadRulesForUser(userId);
  const { profile } = await loadProfileForContext(userId);

  const system = `You are a helpful clinical nutritionist analyzing meal plans.
User: ${fullName}
Health Goals/Rules: ${JSON.stringify(rules)}

Return ONLY valid JSON: { "summary": "...", "faults": [{"day":1,"slot":"dinner","issue":"...","severity":"info","suggestion":"..."}] }`;

  const response = await openaiGenerate('Critique this meal plan', [system, JSON.stringify(plan)]);
  
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
