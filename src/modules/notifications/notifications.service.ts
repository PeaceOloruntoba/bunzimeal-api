import * as repo from './notifications.repo.js';
import { logger } from '../../config/logger.js';

export async function sendNotification(userId: string, title: string, body: string, payload?: any) {
  const tokens = await repo.getPushTokensForUser(userId);
  logger.info(`Sending notification to user ${userId}: ${title}`, { tokenCount: tokens.length });
  
  // TODO: Implement FCM/APNs integration here when ready
  // For now, just log and return
  return { success: true, sentTo: tokens.length, title, body, payload };
}
