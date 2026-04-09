import { Router } from 'express';

import * as academicController from './academic.controller';

const router = Router();

router.get('/subjects', academicController.listSubjects);
router.get('/academic-years', academicController.listAcademicYears);

export default router;
