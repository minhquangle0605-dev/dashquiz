import { Router } from 'express';
import * as systemController from './system.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  updateConfigsSchema,
  listActivityLogsQuerySchema,
  listBackupsQuerySchema,
} from './system.validation';
import { ROLES } from '../../utils/constants';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

// System Configs
router.get('/configs', systemController.getConfigs);
router.put(
  '/configs',
  validate(updateConfigsSchema),
  activityLogger('UPDATE_CONFIGS', 'system_config'),
  systemController.updateConfigs,
);

// Monitoring
router.get('/monitoring', systemController.getMonitoring);

// Activity Logs
router.get(
  '/activity-logs',
  validate(listActivityLogsQuerySchema, 'query'),
  systemController.listActivityLogs,
);

// Backups
router.get(
  '/backups',
  validate(listBackupsQuerySchema, 'query'),
  systemController.listBackups,
);
router.post(
  '/backups',
  activityLogger('CREATE_BACKUP', 'backup'),
  systemController.createBackup,
);
router.post(
  '/backups/:id/restore',
  activityLogger('RESTORE_BACKUP', 'backup'),
  systemController.restoreBackup,
);

export default router;
