import { Router } from 'express';
import * as academicController from './academic.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  createSubjectSchema,
  updateSubjectSchema,
  createAcademicYearSchema,
  updateAcademicYearSchema,
  listSemestersQuerySchema,
} from './academic.validation';
import { ROLES } from '../../utils/constants';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

// Subjects
router.get('/subjects', academicController.listSubjects);
router.post(
  '/subjects',
  validate(createSubjectSchema),
  activityLogger('CREATE_SUBJECT', 'subject'),
  academicController.createSubject,
);
router.put(
  '/subjects/:id',
  validate(updateSubjectSchema),
  activityLogger('UPDATE_SUBJECT', 'subject'),
  academicController.updateSubject,
);

// Academic Years
router.get('/academic-years', academicController.listAcademicYears);
router.post(
  '/academic-years',
  validate(createAcademicYearSchema),
  activityLogger('CREATE_ACADEMIC_YEAR', 'academic_year'),
  academicController.createAcademicYear,
);
router.put(
  '/academic-years/:id',
  validate(updateAcademicYearSchema),
  activityLogger('UPDATE_ACADEMIC_YEAR', 'academic_year'),
  academicController.updateAcademicYear,
);

// Semesters
router.get(
  '/semesters',
  validate(listSemestersQuerySchema, 'query'),
  academicController.listSemesters,
);

export default router;
