import { Router } from 'express';

import * as examController from './exam.controller';

const router = Router();

router.get('/', examController.listExams);

export default router;
