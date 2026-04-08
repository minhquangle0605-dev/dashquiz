import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

const PORT = env.port;

const server = app.listen(PORT, () => {
  logger.info(`
  ╔══════════════════════════════════════════╗
  ║  🚀 WebQuiz API Server                  ║
  ║  Environment: ${env.nodeEnv.padEnd(25)}║
  ║  Port: ${String(PORT).padEnd(33)}║
  ║  Health: http://localhost:${String(PORT).padEnd(13)}║
  ╚══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    logger.info('Server closed. Process exiting.');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});
