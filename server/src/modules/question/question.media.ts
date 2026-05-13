import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { getMinioClient } from '../../config/minio';
import { env } from '../../config/env';
import { AppError } from '../../middlewares/errorHandler';
import { FILE_UPLOAD } from '../../utils/constants';

const QUESTION_IMAGE_PREFIX = 'question-images';
const MAX_GIFT_IMAGE_SIZE = 5 * 1024 * 1024;

export function encodeImageKey(objectName: string): string {
  return Buffer.from(objectName, 'utf8')
    .toString('base64url');
}

export function decodeImageKey(key: string): string {
  const objectName = Buffer.from(key, 'base64url').toString('utf8');
  if (!objectName.startsWith(`${QUESTION_IMAGE_PREFIX}/`)) {
    throw new AppError('Invalid image key', 400);
  }
  return objectName;
}

export function getQuestionImageUrl(objectName: string): string {
  return `/api/questions/images/${encodeImageKey(objectName)}`;
}

export async function uploadQuestionImage(
  userId: number,
  file: Express.Multer.File,
): Promise<{ url: string; objectName: string }> {
  if (!file) throw new AppError('Image file is required', 400);
  if (!(FILE_UPLOAD.ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.mimetype)) {
    throw new AppError('Only JPG, PNG, and WebP images are allowed', 400);
  }
  if (file.size > FILE_UPLOAD.MAX_QUESTION_IMAGE_SIZE) {
    throw new AppError('Question image must not exceed 5MB', 400);
  }

  const ext = file.mimetype.split('/')[1] || 'jpg';
  const objectName = `${QUESTION_IMAGE_PREFIX}/${userId}/${Date.now()}-${randomUUID()}.${ext}`;
  await getMinioClient().putObject(
    env.minio.bucket,
    objectName,
    Readable.from(file.buffer),
    file.size,
    { 'Content-Type': file.mimetype },
  );

  return { objectName, url: getQuestionImageUrl(objectName) };
}

export async function getQuestionImageObject(objectName: string): Promise<{
  stream: NodeJS.ReadableStream;
  contentType: string;
}> {
  const client = getMinioClient();
  const stat = await client.statObject(env.minio.bucket, objectName);
  const stream = await client.getObject(env.minio.bucket, objectName);
  return {
    stream,
    contentType: String(stat.metaData?.['content-type'] || 'application/octet-stream'),
  };
}

export async function readQuestionImageAsDataUri(objectName: string): Promise<string> {
  const { stream, contentType } = await getQuestionImageObject(objectName);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_GIFT_IMAGE_SIZE) {
      throw new AppError('Question image is too large to export to GIFT', 400);
    }
    chunks.push(buffer);
  }
  return `data:${contentType};base64,${Buffer.concat(chunks).toString('base64')}`;
}

export function objectNameFromQuestionImageSrc(src: string): string | null {
  const match = src.match(/\/api\/questions\/images\/([^/?#]+)/);
  if (!match) return null;
  return decodeImageKey(match[1]);
}
