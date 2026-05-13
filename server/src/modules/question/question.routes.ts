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

// Multer instance for Word/PDF document extraction (separate from Excel filter)
const documentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_UPLOAD.MAX_DOCUMENT_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf',
    ];
    const name = (file.originalname || '').toLowerCase();
    if (
      allowedMimes.includes(file.mimetype) ||
      name.endsWith('.docx') ||
      name.endsWith('.doc') ||
      name.endsWith('.pdf')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx, .doc, or .pdf files are allowed'));
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

// ── Extract questions from Word/PDF (teacher/admin) ──
router.post(
  '/extract-from-document',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  documentUpload.single('file'),
  activityLogger('EXTRACT_QUESTIONS_FROM_DOCUMENT', 'question'),
  questionController.extractFromDocument,
);

// ── Bulk create questions from preview (teacher/admin) ──
router.post(
  '/bulk-create',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('BULK_CREATE_QUESTIONS', 'question'),
  questionController.bulkCreateQuestions,
);

// ── Bulk delete questions (teacher/admin) ──
router.post(
  '/bulk-delete',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('BULK_DELETE_QUESTIONS', 'question'),
  questionController.bulkDeleteQuestions,
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
