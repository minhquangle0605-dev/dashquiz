import { Router } from 'express';

const router = Router();

router.get('/me', (_req, res) => {
  res.json({ success: true, message: 'User profile — Phase 2' });
});

router.put('/me', (_req, res) => {
  res.json({ success: true, message: 'Update profile — Phase 2' });
});

export default router;
