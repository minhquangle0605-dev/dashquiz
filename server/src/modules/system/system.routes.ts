import { Router } from 'express';

const router = Router();

router.get('/configs', (_req, res) => {
  res.json({ success: true, message: 'System configs — Phase 3' });
});

router.get('/monitoring', (_req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    success: true,
    message: 'System monitoring',
    data: {
      uptime: process.uptime(),
      memoryUsage: {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`,
      },
      nodeVersion: process.version,
      platform: process.platform,
    },
  });
});

export default router;
