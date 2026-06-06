import { Readable } from 'stream';
import { randomUUID } from 'crypto';
import { getMinioClient } from '../../config/minio';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

// Original import files are stored under this prefix so a failed/abandoned job can
// be retried and kept for audit (PDF §7 "store originals in MinIO for audit and
// retry"). They are never served publicly — only the importer reads them back.
const IMPORT_FILE_PREFIX = 'imports';

/** Strip path separators and odd characters so the stored name stays safe/short. */
function sanitizeFileName(name: string): string {
  const base = (name || 'upload').split(/[\\/]/).pop() || 'upload';
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload';
}

/**
 * Persist the raw uploaded file (Excel/DOCX/PDF/ZIP/GIFT) to MinIO and return the
 * object name. The object name is recorded on the ImportJob so the parser can read
 * it back in the background and a retry can re-run without a fresh upload.
 */
export async function storeImportFile(
  userId: number,
  file: { buffer: Buffer; originalname?: string; mimetype?: string },
): Promise<string> {
  const safeName = sanitizeFileName(file.originalname || 'upload');
  const objectName = `${IMPORT_FILE_PREFIX}/${userId}/${Date.now()}-${randomUUID()}-${safeName}`;
  await getMinioClient().putObject(
    env.minio.bucket,
    objectName,
    Readable.from(file.buffer),
    file.buffer.length,
    { 'Content-Type': file.mimetype || 'application/octet-stream' },
  );
  return objectName;
}

/** Read a previously stored import file back into a Buffer (used by parse/retry). */
export async function fetchImportFile(objectName: string): Promise<Buffer> {
  const stream = await getMinioClient().getObject(env.minio.bucket, objectName);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/**
 * Best-effort delete of a stored import file (called when a job is deleted).
 * Never throws — a missing object should not break job cleanup.
 */
export async function deleteImportFile(objectName: string | null | undefined): Promise<void> {
  if (!objectName) return;
  try {
    await getMinioClient().removeObject(env.minio.bucket, objectName);
  } catch (error) {
    logger.warn(`Failed to delete import file ${objectName}: ${(error as Error).message}`);
  }
}
