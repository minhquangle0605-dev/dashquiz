// MinIO configuration — will be configured when minio SDK is installed
// For now, export config and status

import { env } from './env';

export const getMinioConfig = () => ({
  endPoint: env.minio.endpoint,
  port: env.minio.port,
  useSSL: env.minio.useSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});

export const getMinioStatus = (): { connected: boolean; message: string } => {
  return {
    connected: false,
    message: 'MinIO client not yet initialized. Will be set up in Phase 1.',
  };
};
