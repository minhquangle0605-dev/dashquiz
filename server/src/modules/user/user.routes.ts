import { Router } from 'express';
import multer from 'multer';
import * as userController from './user.controller';
import { authenticate } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import { updateProfileSchema, changePasswordSchema } from './user.validation';
import { FILE_UPLOAD } from '../../utils/constants';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_UPLOAD.MAX_AVATAR_SIZE },
});

router.get(
  '/me',
  authenticate,
  userController.getMe,
);

router.put(
  '/me',
  authenticate,
  validate(updateProfileSchema),
  activityLogger('UPDATE_PROFILE', 'user'),
  userController.updateMe,
);

router.put(
  '/me/password',
  authenticate,
  validate(changePasswordSchema),
  activityLogger('CHANGE_PASSWORD', 'user'),
  userController.changePassword,
);

router.post(
  '/me/avatar',
  authenticate,
  upload.single('avatar'),
  activityLogger('UPLOAD_AVATAR', 'user'),
  userController.uploadAvatar,
);

export default router;
