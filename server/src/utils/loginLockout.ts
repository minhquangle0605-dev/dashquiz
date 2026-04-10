import { getRedisClient } from '../config/redis';
import { AppError } from '../middlewares/errorHandler';
import {
  RATE_LIMIT,
} from './constants';

const PREFIX_FAIL = 'login_fail:v1';
const PREFIX_LOCK = 'login_lock:v1';

export function normalizeLoginUsername(username: string): string {
  return username.trim().toLowerCase();
}

export async function assertLoginNotLocked(clientIp: string, usernameNorm: string): Promise<void> {
  const redis = getRedisClient();
  const lockKey = `${PREFIX_LOCK}:${clientIp}:${usernameNorm}`;
  const ttl = await redis.ttl(lockKey);
  if (ttl > 0) {
    throw new AppError(
      'Too many failed login attempts. Please wait before trying again.',
      429,
      true,
      null,
      { retryAfterSeconds: ttl },
    );
  }
}

export async function recordLoginFailure(clientIp: string, usernameNorm: string): Promise<void> {
  const redis = getRedisClient();
  const failKey = `${PREFIX_FAIL}:${clientIp}:${usernameNorm}`;
  const lockKey = `${PREFIX_LOCK}:${clientIp}:${usernameNorm}`;
  const n = await redis.incr(failKey);
  if (n === 1) {
    await redis.expire(failKey, RATE_LIMIT.LOGIN_FAIL_COUNT_WINDOW_SEC);
  }
  if (n >= RATE_LIMIT.LOGIN_MAX_FAILED_ATTEMPTS) {
    await redis.set(lockKey, '1', 'EX', RATE_LIMIT.LOGIN_LOCKOUT_SECONDS);
    await redis.del(failKey);
  }
}

export async function clearLoginFailureState(clientIp: string, usernameNorm: string): Promise<void> {
  const redis = getRedisClient();
  await redis.del(`${PREFIX_FAIL}:${clientIp}:${usernameNorm}`);
  await redis.del(`${PREFIX_LOCK}:${clientIp}:${usernameNorm}`);
}
