import { Router } from 'express';

import * as analyticsController from './analytics.controller';

const router = Router();

router.get('/student/dashboard', analyticsController.getStudentDashboard);
router.get('/teacher/dashboard', analyticsController.getTeacherDashboard);

export default router;
