import * as repo from './notifications.repo.js';
import { logger } from '../../config/logger.js';

export async function sendNotification(userId: string, title: string, body: string, payload?: any) {
  await createInAppNotification(userId, title, body, payload);
  const tokens = await repo.getPushTokensForUser(userId);
  logger.info({ tokenCount: tokens.length }, `Sending notification to user ${userId}: ${title}`);
  
  // TODO: Implement FCM/APNs integration here when ready
  // For now, just log and return
  return { success: true, sentTo: tokens.length, title, body, payload };
}

export async function createInAppNotification(userId: string, title: string, body: string, payload?: any) {
  return repo.createInAppNotification(userId, payload?.type || 'general', title, body, payload);
}

export async function listInAppNotifications(userId: string) {
  return repo.listInAppNotifications(userId);
}
