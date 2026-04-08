import { Router } from 'express';

const router = Router();

router.get('/student/dashboard', (_req, res) => {
  res.json({ success: true, message: 'Student analytics — Phase 7' });
});

router.get('/teacher/dashboard', (_req, res) => {
  res.json({ success: true, message: 'Teacher analytics — Phase 7' });
});

export default router;
