import { Router } from 'express';

import * as classController from './class.controller';

const router = Router();

router.get('/', classController.listClasses);

export default router;
