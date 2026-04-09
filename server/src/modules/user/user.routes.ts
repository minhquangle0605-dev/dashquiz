import { Router } from 'express';

import * as userController from './user.controller';

const router = Router();

router.get('/me', userController.getMe);
router.put('/me', userController.updateMe);

export default router;
