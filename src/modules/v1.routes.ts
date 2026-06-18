import { Router } from 'express';
import authRoutes from './auth/auth.routes.js';
import usersRoutes from './users/users.routes.js';
import healthEngagementRoutes from './health-engagement/health-engagement.routes.js';
import notificationsRoutes from './notifications/notifications.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/health', healthEngagementRoutes);
router.use('/notifications', notificationsRoutes);

export default router;
