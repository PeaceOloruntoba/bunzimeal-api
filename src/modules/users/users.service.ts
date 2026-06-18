import * as repo from './users.repo.js';
import type { MacroTotals } from './users.repo.js';

export type SummaryPeriod = 'today' | 'week' | 'month';
export type DayBreakdown = { date: string; weekday: string; totals: MacroTotals };
export type SummaryResult = { period: SummaryPeriod; range: { from: string; to: string }; totals: MacroTotals; days?: DayBreakdown[] };

function weekdayName(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

function add(a: MacroTotals, b: MacroTotals): MacroTotals {
  return {
    calories: Number(a.calories || 0) + Number(b.calories || 0),
    protein_grams: Number(a.protein_grams || 0) + Number(b.protein_grams || 0),
    carbs_grams: Number(a.carbs_grams || 0) + Number(b.carbs_grams || 0),
    fat_grams: Number(a.fat_grams || 0) + Number(b.fat_grams || 0),
  };
}

function zeroTotals(): MacroTotals {
  return { calories: 0, protein_grams: 0, carbs_grams: 0, fat_grams: 0 };
}

function roundTotals(t: MacroTotals): MacroTotals {
  return {
    calories: Math.round((Number(t.calories) || 0) * 100) / 100,
    protein_grams: Math.round((Number(t.protein_grams) || 0) * 100) / 100,
    carbs_grams: Math.round((Number(t.carbs_grams) || 0) * 100) / 100,
    fat_grams: Math.round((Number(t.fat_grams) || 0) * 100) / 100,
  };
}

function recipeIdsFromDay(day: any): number[] {
  const ids: number[] = [];
  for (const k of ['breakfast', 'lunch', 'dinner'] as const) {
    const entry = day?.[k];
    if (entry && typeof entry.id === 'number') ids.push(entry.id);
  }
  return ids;
}

async function totalForWeekday(plan: any, name: string): Promise<MacroTotals> {
  let day: any;
  if (!plan) return zeroTotals();
  
  if (plan[name]) {
    day = plan[name];
  } else {
    const lower = name.toLowerCase();
    for (const k of Object.keys(plan)) {
      if (k.toLowerCase() === lower) {
        day = plan[k];
        break;
      }
    }
    if (!day) {
      for (const k of Object.keys(plan)) {
        if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
          const dt = new Date(k);
          if (!isNaN(dt.getTime()) && weekdayName(dt).toLowerCase() === lower) {
            day = plan[k];
            break;
          }
        }
      }
    }
  }
  
  if (!day) return zeroTotals();
  const ids = recipeIdsFromDay(day);
  const map = await repo.getNutritionByRecipeIds(ids);
  let total = zeroTotals();
  for (const id of ids) total = add(total, map[id] || zeroTotals());
  return roundTotals(total);
}

export async function computeStatsSummary(userId: string, period: SummaryPeriod, now = new Date()): Promise<SummaryResult> {
  const plan = await repo.getUserMealPlan(userId);
  const currentDate = new Date(now);
  const fromTo = { from: '', to: '' };
  
  if (period === 'today') {
    const weekday = weekdayName(currentDate);
    const totals = await totalForWeekday(plan, weekday);
    const dateStr = currentDate.toISOString().slice(0, 10);
    fromTo.from = dateStr;
    fromTo.to = dateStr;
    return { period, range: fromTo, totals };
  }
  
  if (period === 'week') {
    const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const days: DayBreakdown[] = [];
    let totals = zeroTotals();
    
    for (const label of labels) {
      const t = await totalForWeekday(plan, label);
      totals = add(totals, t);
      days.push({ date: label, weekday: label, totals: roundTotals(t) });
    }
    
    const dayIdx = (currentDate.getDay() + 6) % 7;
    const monday = new Date(currentDate);
    monday.setDate(currentDate.getDate() - dayIdx);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    fromTo.from = monday.toISOString().slice(0, 10);
    fromTo.to = sunday.toISOString().slice(0, 10);
    totals = roundTotals(totals);
    return { period, range: fromTo, totals, days };
  }
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: DayBreakdown[] = [];
  let totals = zeroTotals();
  
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const label = weekdayName(date);
    const t = await totalForWeekday(plan, label);
    totals = add(totals, t);
    days.push({ date: date.toISOString().slice(0, 10), weekday: label, totals: roundTotals(t) });
  }
  
  const first = new Date(year, month, 1).toISOString().slice(0, 10);
  const last = new Date(year, month, daysInMonth).toISOString().slice(0, 10);
  fromTo.from = first;
  fromTo.to = last;
  totals = roundTotals(totals);
  return { period, range: fromTo, totals, days };
}
