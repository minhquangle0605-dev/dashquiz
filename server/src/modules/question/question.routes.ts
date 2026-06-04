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
      'text/plain',
      'application/gift',
    ];
    const name = (file.originalname || '').toLowerCase();
    if (
      allowedMimes.includes(file.mimetype) ||
      name.endsWith('.docx') ||
      name.endsWith('.doc') ||
      name.endsWith('.pdf') ||
      name.endsWith('.txt') ||
      name.endsWith('.gift')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .docx, .doc, .pdf, .txt, or .gift files are allowed'));
    }
  },
});

// Multer instance for ZIP question+image bundles
const zipUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_UPLOAD.MAX_ZIP_IMPORT_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = [
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
      'multipart/x-zip',
    ];
    const name = (file.originalname || '').toLowerCase();
    if (allowedMimes.includes(file.mimetype) || name.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are allowed'));
    }
  },
});

// ── Public (authenticated) ──────────────────────
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: FILE_UPLOAD.MAX_QUESTION_IMAGE_SIZE },
  fileFilter: (_req, file, cb) => {
    if ((FILE_UPLOAD.ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, and WebP images are allowed'));
    }
  },
});

router.get('/images/:key', questionController.serveQuestionImage);

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
router.get(
  '/document-import-template',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  questionController.downloadDocumentImportTemplate,
);

router.post(
  '/import',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  upload.single('file'),
  activityLogger('IMPORT_QUESTIONS', 'question'),
  questionController.importQuestions,
);

// ── ZIP import template + import (teacher/admin) ──
router.get(
  '/zip-import-template',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  questionController.downloadZipImportTemplate,
);

router.post(
  '/import-zip',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  zipUpload.single('file'),
  activityLogger('IMPORT_QUESTIONS_ZIP', 'question'),
  questionController.importQuestionsFromZip,
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

router.post(
  '/images',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  imageUpload.single('image'),
  activityLogger('UPLOAD_QUESTION_IMAGE', 'question_image'),
  questionController.uploadQuestionImageFile,
);

router.post(
  '/export-gift',
  authenticate,
  authorize(ROLES.TEACHER, ROLES.ADMIN),
  activityLogger('EXPORT_QUESTIONS_GIFT', 'question'),
  questionController.exportQuestionsGift,
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
