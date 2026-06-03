import { Router } from 'express';
import multer from 'multer';
import * as classController from './class.controller';
import * as gradebookController from './gradebook.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  createClassSchema,
  updateClassSchema,
  addStudentsSchema,
  listClassesQuerySchema,
  listStudentsQuerySchema,
  availableStudentsQuerySchema,
  listClassNamesQuerySchema,
  createSectionSchema,
  updateSectionSchema,
  createResourceSchema,
  updateResourceSchema,
  createActivitySchema,
  updateActivitySchema,
  submitActivitySchema,
  gradeSubmissionSchema,
  createForumPostSchema,
  recordAttendanceSchema,
  markCompletionSchema,
  assignClassRoleSchema,
  createManualGradeSchema,
  updateGradeScoreSchema,
  deleteGradeSchema,
  linkClassSchema,
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

const resourceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_UPLOAD.MAX_CLASS_RESOURCE_SIZE },
});

// ── Download import template (GET /api/classes/import-template) ──
router.get(
  '/import-template',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  classController.downloadImportTemplate,
);

// ── List distinct homeroom class names (GET /api/classes/class-names) ─
router.get(
  '/class-names',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(listClassNamesQuerySchema, 'query'),
  classController.listClassNames,
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

router.get(
  '/resources/:resourceId/download',
  authenticate,
  classController.getResourceDownloadUrl,
);

router.get('/:id/course', authenticate, classController.getCourse);

// ── Gradebook (Vietnamese MOET style) ──────────────
router.get(
  '/gradebooks',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  gradebookController.getAccessibleGradebooks,
);

router.get(
  '/:id/gradebook',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  gradebookController.getClassGradebook,
);

router.get(
  '/:id/gradebook/my',
  authenticate,
  authorize(ROLES.STUDENT, ROLES.PARENT),
  gradebookController.getMyGradebook,
);

router.post(
  '/:id/gradebook/grades',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createManualGradeSchema),
  activityLogger('CREATE_STUDENT_GRADE', 'student_grade'),
  gradebookController.createManualGrade,
);

router.put(
  '/:id/gradebook/grades/:gradeId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(updateGradeScoreSchema),
  activityLogger('UPDATE_STUDENT_GRADE', 'student_grade'),
  gradebookController.updateGradeScore,
);

router.delete(
  '/:id/gradebook/grades/:gradeId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(deleteGradeSchema),
  activityLogger('DELETE_STUDENT_GRADE', 'student_grade'),
  gradebookController.deleteGrade,
);

router.get(
  '/:id/gradebook/grades/:gradeId/history',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  gradebookController.listGradeHistory,
);

router.get(
  '/:id/gradebook/history',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  gradebookController.listClassHistory,
);

router.put(
  '/:id/gradebook/link',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(linkClassSchema),
  activityLogger('LINK_CLASS_SEMESTER', 'class'),
  gradebookController.linkClass,
);

router.post(
  '/:id/sections',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createSectionSchema),
  activityLogger('CREATE_CLASS_SECTION', 'class_section'),
  classController.createSection,
);

router.put(
  '/:id/sections/:sectionId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(updateSectionSchema),
  activityLogger('UPDATE_CLASS_SECTION', 'class_section'),
  classController.updateSection,
);

router.delete(
  '/:id/sections/:sectionId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('DELETE_CLASS_SECTION', 'class_section'),
  classController.deleteSection,
);

router.post(
  '/:id/resources',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createResourceSchema),
  activityLogger('CREATE_CLASS_RESOURCE', 'class_resource'),
  classController.createResource,
);

router.post(
  '/:id/resources/upload',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  resourceUpload.single('file'),
  activityLogger('UPLOAD_CLASS_RESOURCE', 'class_resource'),
  classController.uploadResource,
);

router.put(
  '/:id/resources/:resourceId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(updateResourceSchema),
  activityLogger('UPDATE_CLASS_RESOURCE', 'class_resource'),
  classController.updateResource,
);

router.delete(
  '/:id/resources/:resourceId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('DELETE_CLASS_RESOURCE', 'class_resource'),
  classController.deleteResource,
);

router.post(
  '/:id/activities',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createActivitySchema),
  activityLogger('CREATE_CLASS_ACTIVITY', 'class_activity'),
  classController.createActivity,
);

router.put(
  '/:id/activities/:activityId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(updateActivitySchema),
  activityLogger('UPDATE_CLASS_ACTIVITY', 'class_activity'),
  classController.updateActivity,
);

router.delete(
  '/:id/activities/:activityId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('DELETE_CLASS_ACTIVITY', 'class_activity'),
  classController.deleteActivity,
);

router.post(
  '/activities/:activityId/submissions',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(submitActivitySchema),
  activityLogger('SUBMIT_CLASS_ACTIVITY', 'class_submission'),
  classController.submitActivity,
);

router.get(
  '/activities/:activityId/submissions',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  classController.listSubmissions,
);

router.put(
  '/submissions/:submissionId/grade',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(gradeSubmissionSchema),
  activityLogger('GRADE_CLASS_SUBMISSION', 'class_submission'),
  classController.gradeSubmission,
);

router.get(
  '/activities/:activityId/forum-posts',
  authenticate,
  classController.listForumPosts,
);

router.post(
  '/activities/:activityId/forum-posts',
  authenticate,
  validate(createForumPostSchema),
  activityLogger('CREATE_CLASS_FORUM_POST', 'class_forum_post'),
  classController.createForumPost,
);

router.put(
  '/activities/:activityId/attendance',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(recordAttendanceSchema),
  activityLogger('RECORD_CLASS_ATTENDANCE', 'class_attendance_record'),
  classController.recordAttendance,
);

router.post(
  '/:id/completions',
  authenticate,
  authorize(ROLES.STUDENT),
  validate(markCompletionSchema),
  activityLogger('MARK_CLASS_COMPLETION', 'class_completion'),
  classController.markCompletion,
);

router.put(
  '/:id/roles',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(assignClassRoleSchema),
  activityLogger('ASSIGN_CLASS_ROLE', 'class_member_role'),
  classController.assignClassRole,
);

router.get(
  '/:id/logs',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  classController.listLogs,
);

// ── List students (GET /api/classes/:id/students) ─
router.get(
  '/:id/students',
  authenticate,
  validate(listStudentsQuerySchema, 'query'),
  classController.listStudents,
);

// ── List classmates (GET /api/classes/:id/classmates) ─
// Lightweight roster for enrolled students (no contact info).
router.get(
  '/:id/classmates',
  authenticate,
  classController.listClassmates,
);

// ── List available students for adding (GET /api/classes/:id/available-students) ─
router.get(
  '/:id/available-students',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(availableStudentsQuerySchema, 'query'),
  classController.listAvailableStudents,
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
