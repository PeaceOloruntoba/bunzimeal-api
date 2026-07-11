import cron from 'node-cron';
import { query } from '../../db/pool.js';
import { logger } from '../../config/logger.js';
import * as notifications from './notifications.service.js';
import * as healthLogs from '../health-engagement/health-engagement.repo.js';
import * as billingService from '../billing/billing.service.js';

// This will be implemented properly when we have the meal plan structure
async function checkAndSendMealReminders() {
  logger.info('Running meal reminder cron job');
  // TODO: Implement meal reminder logic
}

async function checkAndSendStreakAlerts() {
  logger.info('Running streak alert cron job');
  const { rows: users } = await query<{ id: string }>(
    'SELECT id FROM users WHERE deleted_at IS NULL'
  );
  
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  
  for (const user of users) {
    const streak = await healthLogs.getUserStreak(user.id);
    if (!streak || !streak.last_check_in_date || streak.last_check_in_date === today) {
      continue;
    }
    
    const weightLog = await healthLogs.getHealthLogByDate(user.id, today, 'weight');
    const waterLog = await healthLogs.getHealthLogByDate(user.id, today, 'water');
    
    if (!weightLog && !waterLog) {
      await notifications.sendNotification(
        user.id,
        'Don\'t Lose Your Streak! 🎯',
        'Log your weight or water intake today to keep your streak alive!',
        { type: 'streak_reminder' }
      );
    }
  }
}

export function startCronJobs() {
  // Run meal reminders every hour (adjust as needed)
  cron.schedule('0 * * * *', checkAndSendMealReminders);
  
  // Run streak protection alerts at 8 PM every day
  cron.schedule('0 20 * * *', checkAndSendStreakAlerts);

  // Run expiry notifications at 9 AM every day
  cron.schedule('0 9 * * *', billingService.sendExpiryNotifications);
  
  logger.info('Cron jobs started');
}
