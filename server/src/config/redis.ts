// Redis configuration — will be configured when ioredis is installed
// For now, export status checker

import { env } from './env';

export const getRedisConfig = () => ({
  host: env.redis.host,
  port: env.redis.port,
  password: env.redis.password,
});

export const getRedisStatus = (): { connected: boolean; message: string } => {
  return {
    connected: false,
    message: 'Redis client not yet initialized. Will be set up in Phase 1.',
  };
};
