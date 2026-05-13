import { Router } from 'express';
import multer from 'multer';
import * as classController from './class.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  createClassSchema,
  updateClassSchema,
  addStudentsSchema,
  listClassesQuerySchema,
  listStudentsQuerySchema,
} from './class.validation';
import { ROLES } from '../../utils/constants';
import { FILE_UPLOAD } from '../../utils/constants';

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

// ── Download import template (GET /api/classes/import-template) ──
router.get(
  '/import-template',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  classController.downloadImportTemplate,
);

// ── List my enrolled classes (GET /api/classes/my) ─
// Returns the classes the authenticated student belongs to.
router.get(
  '/my',
  authenticate,
  authorize(ROLES.STUDENT),
  classController.listMyClasses,
);

// ── List classes (GET /api/classes) ──────────────
router.get(
  '/',
  authenticate,
  validate(listClassesQuerySchema, 'query'),
  classController.listClasses,
);

// ── Create class (POST /api/classes) ─────────────
router.post(
  '/',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createClassSchema),
  activityLogger('CREATE_CLASS', 'class'),
  classController.createClass,
);

// ── Update class (PUT /api/classes/:id) ──────────
router.put(
  '/:id',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(updateClassSchema),
  activityLogger('UPDATE_CLASS', 'class'),
  classController.updateClass,
);

// ── List students (GET /api/classes/:id/students) ─
router.get(
  '/:id/students',
  authenticate,
  validate(listStudentsQuerySchema, 'query'),
  classController.listStudents,
);

// ── Add students (POST /api/classes/:id/students) ─
router.post(
  '/:id/students',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(addStudentsSchema),
  activityLogger('ADD_CLASS_STUDENTS', 'class_student'),
  classController.addStudents,
);

// ── Remove student (DELETE /api/classes/:id/students/:studentId) ─
router.delete(
  '/:id/students/:studentId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('REMOVE_CLASS_STUDENT', 'class_student'),
  classController.removeStudent,
);

// ── Import students from Excel (POST /api/classes/:id/students/import) ─
router.post(
  '/:id/students/import',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  upload.single('file'),
  activityLogger('IMPORT_CLASS_STUDENTS', 'class_student'),
  classController.importStudents,
);

export default router;
