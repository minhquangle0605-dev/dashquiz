import { Router } from 'express';

import * as systemController from './system.controller';

const router = Router();

router.get('/configs', systemController.getConfigs);
router.get('/monitoring', systemController.getMonitoring);

export default router;
