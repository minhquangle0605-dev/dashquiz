import { Router } from 'express';
import multer from 'multer';
import * as userController from './user.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  listUsersQuerySchema,
  createUserSchema,
  updateUserSchema,
  changeRoleSchema,
} from './user.validation';
import { ROLES, FILE_UPLOAD } from '../../utils/constants';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_UPLOAD.MAX_EXCEL_SIZE },
});

router.use(authenticate, authorize(ROLES.ADMIN));

router.get(
  '/',
  validate(listUsersQuerySchema, 'query'),
  userController.adminListUsers,
);

router.get('/roles', userController.adminListRoles);

router.post(
  '/',
  validate(createUserSchema),
  activityLogger('CREATE_USER', 'user'),
  userController.adminCreateUser,
);

router.put(
  '/:id',
  validate(updateUserSchema),
  activityLogger('UPDATE_USER', 'user'),
  userController.adminUpdateUser,
);

router.delete(
  '/:id',
  activityLogger('DELETE_USER', 'user'),
  userController.adminDeleteUser,
);

router.put(
  '/:id/role',
  validate(changeRoleSchema),
  activityLogger('CHANGE_ROLE', 'user'),
  userController.adminChangeRole,
);

router.post(
  '/import',
  upload.single('file'),
  activityLogger('IMPORT_USERS', 'user'),
  userController.adminImportUsers,
);

router.get(
  '/import-template',
  userController.adminGetImportTemplate,
);

export default router;
