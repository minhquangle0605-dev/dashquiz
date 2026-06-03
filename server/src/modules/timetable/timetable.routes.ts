import { Router } from 'express';
import multer from 'multer';
import * as timetableController from './timetable.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  createSlotSchema,
  updateSlotSchema,
  checkConflictsSchema,
  createTimetableClassSchema,
} from './timetable.validation';
import { ROLES, FILE_UPLOAD } from '../../utils/constants';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_UPLOAD.MAX_EXCEL_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx and .xls files are allowed'));
    }
  },
});

// ── Download import template (GET /api/timetable/import-template) ──
router.get(
  '/import-template',
  authenticate,
  authorize(ROLES.ADMIN),
  timetableController.downloadImportTemplate,
);

// ── Check exam-schedule conflicts (POST /api/timetable/check-conflicts) ──
router.post(
  '/check-conflicts',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(checkConflictsSchema),
  timetableController.checkConflicts,
);

// ── Create class (POST /api/timetable/classes) ──
// Timetable-only: name + grade. Subject/semester/teacher are copied from an
// existing class server-side. Distinct from POST /api/classes.
router.post(
  '/classes',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createTimetableClassSchema),
  activityLogger('CREATE_CLASS', 'class'),
  timetableController.createClass,
);

// ── View class timetable (GET /api/timetable/classes/:classId) ──
// Open to all roles; the service scopes access (teacher/admin/enrolled student/parent).
router.get(
  '/classes/:classId',
  authenticate,
  timetableController.getClassTimetable,
);

// ── Clear whole class timetable (DELETE /api/timetable/classes/:classId) ──
router.delete(
  '/classes/:classId',
  authenticate,
  authorize(ROLES.ADMIN),
  activityLogger('CLEAR_TIMETABLE', 'class_timetable_slot'),
  timetableController.clearTimetable,
);

// ── Create slot (POST /api/timetable/classes/:classId/slots) ──
router.post(
  '/classes/:classId/slots',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(createSlotSchema),
  activityLogger('CREATE_TIMETABLE_SLOT', 'class_timetable_slot'),
  timetableController.createSlot,
);

// ── Update slot (PUT /api/timetable/classes/:classId/slots/:slotId) ──
router.put(
  '/classes/:classId/slots/:slotId',
  authenticate,
  authorize(ROLES.ADMIN),
  validate(updateSlotSchema),
  activityLogger('UPDATE_TIMETABLE_SLOT', 'class_timetable_slot'),
  timetableController.updateSlot,
);

// ── Cancel slot (DELETE /api/timetable/classes/:classId/slots/:slotId) ──
router.delete(
  '/classes/:classId/slots/:slotId',
  authenticate,
  authorize(ROLES.ADMIN),
  activityLogger('CANCEL_TIMETABLE_SLOT', 'class_timetable_slot'),
  timetableController.cancelSlot,
);

// ── Import timetable from Excel (POST /api/timetable/classes/:classId/import) ──
router.post(
  '/classes/:classId/import',
  authenticate,
  authorize(ROLES.ADMIN),
  upload.single('file'),
  activityLogger('IMPORT_TIMETABLE', 'class_timetable_slot'),
  timetableController.importTimetable,
);

export default router;
