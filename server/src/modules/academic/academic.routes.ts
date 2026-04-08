import { Router } from 'express';

const router = Router();

router.get('/subjects', (_req, res) => {
  res.json({ success: true, message: 'Subjects — Phase 3' });
});

router.get('/academic-years', (_req, res) => {
  res.json({ success: true, message: 'Academic years — Phase 3' });
});

export default router;
