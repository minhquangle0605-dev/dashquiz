import { Router } from 'express';
import multer from 'multer';
import * as controller from './importJob.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { activityLogger } from '../../middlewares/activityLogger';
import { ROLES } from '../../utils/constants';
import { FILE_UPLOAD } from '../../utils/constants';

// Unified import pipeline routes. Mounted at /api/questions in app.ts BEFORE the
// generic question routes so that `/import-jobs/...` is not swallowed by `GET /:id`.
const importJobRouter = Router();

const ALLOWED_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/pdf',
  'text/plain',
  'application/gift',
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
  'application/octet-stream',
  // Image sources for OCR.
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];
const ALLOWED_EXT = /\.(xlsx|xls|docx|doc|pdf|txt|gift|zip|png|jpe?g|webp)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  // The ZIP bundle is the largest supported source, so use that as the ceiling.
  limits: { fileSize: FILE_UPLOAD.MAX_ZIP_IMPORT_SIZE },
  fileFilter: (_req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    if (ALLOWED_MIMES.includes(file.mimetype) || ALLOWED_EXT.test(name)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type. Use Excel, Word/PDF/TXT/GIFT, or a ZIP bundle.'));
    }
  },
});

const guard = [authenticate, authorize(ROLES.TEACHER, ROLES.ADMIN)];

importJobRouter.post(
  '/import-jobs',
  ...guard,
  upload.single('file'),
  activityLogger('CREATE_IMPORT_JOB', 'import_job'),
  controller.createImportJob,
);

// Bank-level duplicate review (distinct paths, safe before questionRoutes' /:id).
importJobRouter.get('/duplicates', ...guard, controller.listDuplicateClusters);
importJobRouter.post(
  '/duplicates/resolve',
  ...guard,
  activityLogger('RESOLVE_DUPLICATE', 'question'),
  controller.resolveDuplicate,
);

importJobRouter.get('/import-jobs', ...guard, controller.listImportJobs);
importJobRouter.get('/import-jobs/:id', ...guard, controller.getImportJob);
importJobRouter.get('/import-jobs/:id/preview', ...guard, controller.getImportJobPreview);

importJobRouter.put('/import-preview/:itemId', ...guard, controller.updateImportPreviewItem);

importJobRouter.post('/import-jobs/:id/bulk-fix', ...guard, controller.bulkFixImportJob);
importJobRouter.post('/import-jobs/:id/validate', ...guard, controller.revalidateImportJob);

importJobRouter.post(
  '/import-jobs/:id/commit',
  ...guard,
  activityLogger('COMMIT_IMPORT_JOB', 'import_job'),
  controller.commitImportJob,
);

importJobRouter.post('/import-jobs/:id/retry', ...guard, controller.retryImportJob);

importJobRouter.delete(
  '/import-jobs/:id',
  ...guard,
  activityLogger('DELETE_IMPORT_JOB', 'import_job'),
  controller.deleteImportJob,
);

export { importJobRouter };
