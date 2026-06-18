import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import usersRoutes from './users/users.routes.js';
import healthEngagementRoutes from './health-engagement/health-engagement.routes.js';
import notificationsRoutes from './notifications/notifications.routes.js';
import nutritionRoutes from './nutrition/nutrition.routes.js';
import pantryRoutes from './pantry/pantry.routes.js';
import shoppingListRoutes from './shopping-list/shopping-list.routes.js';
import aiChatRoutes from './ai-chat/ai-chat.routes.js';
import billingRoutes from './billing/billing.routes.js';
import localizationRoutes from './localization/localization.routes.js';
import referralsRoutes from './referrals/referrals.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/health', healthEngagementRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/nutrition', nutritionRoutes);
router.use('/pantry', pantryRoutes);
router.use('/shopping-list', shoppingListRoutes);
router.use('/ai', aiChatRoutes);
router.use('/billing', billingRoutes);
router.use('/localization', localizationRoutes);
router.use('/referrals', referralsRoutes);

export default router;
