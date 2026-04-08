import { Router } from 'express';

const router = Router();

router.post('/practice/start', (_req, res) => {
  res.json({ success: true, message: 'AI practice — Phase 9' });
});

export default router;
