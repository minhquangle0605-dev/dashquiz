import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (redis) return redis;

  redis = new Redis({
    host: env.redis.host,
    port: env.redis.port,
    password: env.redis.password || undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 10) return null;
      const delay = Math.min(times * 200, 5000);
      logger.warn(`Redis reconnecting... attempt ${times}, next in ${delay}ms`);
      return delay;
    },
  });

  redis.on('connect', () => logger.info('Redis connected'));
  redis.on('ready', () => logger.info('Redis ready'));
  redis.on('error', (err) => logger.error('Redis error:', err.message));
  redis.on('close', () => logger.warn('Redis connection closed'));

  return redis;
}

export async function connectRedis(): Promise<void> {
  const client = getRedisClient();
  try {
    const pong = await client.ping();
    logger.info(`Redis PING → ${pong}`);
  } catch (error) {
    logger.error('Failed to connect to Redis:', error);
    throw error;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis disconnected');
  }
}

export const getRedisStatus = async (): Promise<{ connected: boolean; message: string }> => {
  try {
    const client = getRedisClient();
    const pong = await client.ping();
    return { connected: pong === 'PONG', message: `Redis: ${pong}` };
  } catch {
    return { connected: false, message: 'Redis connection failed' };
  }
};

export const getRedisConfig = () => ({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
});
