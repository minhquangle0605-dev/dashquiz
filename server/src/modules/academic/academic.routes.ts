import { Router } from 'express';
import * as academicController from './academic.controller';
import { authenticate, authorize } from '../../middlewares/auth';
import { validate } from '../../middlewares/validate';
import { activityLogger } from '../../middlewares/activityLogger';
import {
  updateSubjectSchema,
  createAcademicYearSchema,
  updateAcademicYearSchema,
  listSemestersQuerySchema,
  createSemesterSchema,
  updateSemesterSchema,
} from './academic.validation';
import { ROLES } from '../../utils/constants';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

// Subjects
router.get('/subjects', academicController.listSubjects);
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
router.post(
  '/semesters',
  validate(createSemesterSchema),
  activityLogger('CREATE_SEMESTER', 'semester'),
  academicController.createSemester,
);
router.put(
  '/semesters/:id',
  validate(updateSemesterSchema),
  activityLogger('UPDATE_SEMESTER', 'semester'),
  academicController.updateSemester,
);

export default router;
