import { Router } from 'express';
import multer from 'multer';
import * as questionController from './question.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  createQuestionSchema,
  updateQuestionSchema,
  listQuestionsQuerySchema,
  addTagsSchema,
} from './question.validation';
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

// ── Public (authenticated) ──────────────────────
router.get(
  '/',
  authenticate,
  validate(listQuestionsQuerySchema, 'query'),
  questionController.listQuestions,
);

// ── Template download (teacher/admin) ───────────
router.get(
  '/import-template',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  questionController.downloadImportTemplate,
);

// ── Excel import (teacher/admin) ────────────────
router.post(
  '/import',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  upload.single('file'),
  activityLogger('IMPORT_QUESTIONS', 'question'),
  questionController.importQuestions,
);

// ── Get single question ─────────────────────────
router.get(
  '/:id',
  authenticate,
  questionController.getQuestion,
);

// ── Create question (teacher/admin) ─────────────
router.post(
  '/',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(createQuestionSchema),
  activityLogger('CREATE_QUESTION', 'question'),
  questionController.createQuestion,
);

// ── Update question (teacher/admin) ─────────────
router.put(
  '/:id',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(updateQuestionSchema),
  activityLogger('UPDATE_QUESTION', 'question'),
  questionController.updateQuestion,
);

// ── Delete question (teacher/admin) ─────────────
router.delete(
  '/:id',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('DELETE_QUESTION', 'question'),
  questionController.deleteQuestion,
);

// ── Tags management ─────────────────────────────
router.post(
  '/:id/tags',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  validate(addTagsSchema),
  activityLogger('ADD_QUESTION_TAGS', 'question_tag'),
  questionController.addTags,
);

router.delete(
  '/:id/tags/:tagId',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('REMOVE_QUESTION_TAG', 'question_tag'),
  questionController.removeTag,
);

export default router;
