import * as Minio from 'minio';
import { env } from './env';
import { logger } from '../utils/logger';

let minioClient: Minio.Client | null = null;

export function getMinioClient(): Minio.Client {
  if (minioClient) return minioClient;

  minioClient = new Minio.Client({
    endPoint: env.minio.endpoint,
    port: env.minio.port,
    useSSL: env.minio.useSSL,
    accessKey: env.minio.accessKey,
    secretKey: env.minio.secretKey,
  });

  return minioClient;
}

export async function connectMinio(): Promise<void> {
  const client = getMinioClient();
  const bucket = env.minio.bucket;

  try {
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket, 'us-east-1');
      logger.info(`MinIO bucket "${bucket}" created`);
    } else {
      logger.info(`MinIO bucket "${bucket}" already exists`);
    }
    logger.info('MinIO connected');
  } catch (error) {
    logger.error('Failed to connect to MinIO:', error);
    throw error;
  }
}

export const getMinioStatus = async (): Promise<{ connected: boolean; message: string }> => {
  try {
    const client = getMinioClient();
    const exists = await client.bucketExists(env.minio.bucket);
    return {
      connected: true,
      message: `MinIO connected, bucket "${env.minio.bucket}" ${exists ? 'exists' : 'missing'}`,
    };
  } catch {
    return { connected: false, message: 'MinIO connection failed' };
  }
};

export const getMinioConfig = () => ({
  endPoint: env.minio.endpoint,
  port: env.minio.port,
  useSSL: env.minio.useSSL,
  accessKey: env.minio.accessKey,
  secretKey: env.minio.secretKey,
});
