import { getRedisClient } from '../config/redis';
import { logger } from './logger';

export const DEFAULT_CACHE_TTL = 300; // 5 minutes

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const redis = getRedisClient();
    const cached = await redis.get(key);
    if (cached) return JSON.parse(cached) as T;
  } catch (err) {
    logger.warn('Redis cache read failed:', err);
  }
  return null;
}

export async function cacheSet(key: string, data: unknown, ttl: number = DEFAULT_CACHE_TTL): Promise<void> {
  try {
    const redis = getRedisClient();
    await redis.set(key, JSON.stringify(data), 'EX', ttl);
  } catch (err) {
    logger.warn('Redis cache write failed:', err);
  }
}

/**
 * Invalidate cache keys matching a glob pattern using SCAN (non-blocking).
 * Reference: https://redis.io/docs/latest/commands/scan/
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const redis = getRedisClient();
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('Redis cache invalidation failed:', err);
  }
}

export async function cacheInvalidateExact(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    const redis = getRedisClient();
    await redis.del(...keys);
  } catch (err) {
    logger.warn('Redis cache invalidation failed:', err);
  }
}

export async function withCache<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const cached = await cacheGet<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  await cacheSet(key, data, ttl);
  return data;
}
