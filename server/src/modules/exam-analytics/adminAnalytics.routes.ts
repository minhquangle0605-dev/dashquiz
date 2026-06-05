import { Router } from 'express';

import { authenticate, authorize } from '../../middlewares/auth';
import { ROLES } from '../../utils/constants';
import * as controller from './adminAnalytics.controller';

// School-wide analytics for admins. Mounted at /api/admin in app.ts.
// → GET /api/admin/analytics/{overview,classes,subjects}
export const adminAnalyticsRouter = Router();

const guard = [authenticate, authorize(ROLES.ADMIN)] as const;

adminAnalyticsRouter.get('/analytics/overview', ...guard, controller.getOverview);
adminAnalyticsRouter.get('/analytics/classes', ...guard, controller.getClasses);
adminAnalyticsRouter.get('/analytics/subjects', ...guard, controller.getSubjects);
