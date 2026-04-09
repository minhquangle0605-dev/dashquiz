import { Router } from 'express';

import * as aiController from './ai.controller';

const router = Router();

router.post('/practice/start', aiController.startPractice);

export default router;
