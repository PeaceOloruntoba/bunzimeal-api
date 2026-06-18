import { Router } from 'express';
import usersRoutes from './users/users.routes.js';
import contentRoutes from './content/content.routes.js';
import notificationsRoutes from './notifications/notifications.routes.js';
import affiliatesRoutes from './affiliates/affiliates.routes.js';
import affiliateRequestsRoutes from './affiliate-requests/affiliate-requests.routes.js';

const router = Router();

router.use('/users', usersRoutes);
router.use('/content', contentRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/affiliates', affiliatesRoutes);
router.use('/affiliate-requests', affiliateRequestsRoutes);

export default router;

