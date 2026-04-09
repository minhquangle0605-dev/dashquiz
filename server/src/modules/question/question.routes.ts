import { Router } from 'express';

import * as questionController from './question.controller';

const router = Router();

router.get('/', questionController.listQuestions);

export default router;
