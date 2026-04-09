import app from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { connectMinio } from './config/minio';

const PORT = env.port;

async function bootstrap() {
  try {
    await connectDatabase();
    await connectRedis();
    await connectMinio();
  } catch (error) {
    logger.error('Service initialization failed:', error);
    logger.warn('Server will start but some services may be unavailable');
  }

  const server = app.listen(PORT, () => {
    logger.info(`
  ╔══════════════════════════════════════════╗
  ║  WebQuiz API Server                     ║
  ║  Environment: ${env.nodeEnv.padEnd(25)}║
  ║  Port: ${String(PORT).padEnd(33)}║
  ║  Health: http://localhost:${String(PORT).padEnd(13)}║
  ╚══════════════════════════════════════════╝
    `);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    server.close(async () => {
      await disconnectDatabase();
      await disconnectRedis();
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
}

bootstrap();
