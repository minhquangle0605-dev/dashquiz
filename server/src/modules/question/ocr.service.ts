import path from 'path';
import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// OCR SERVICE (PDF §7 OCR processing, §11 OCR strategy)
//
// Wraps tesseract.js (pure-WASM, no native build) to turn page/question images
// into text + a 0-100 confidence score. A worker is created per OCR operation and
// terminated afterwards (no shared mutable worker → no concurrency races). Language
// data is cached on disk so repeat runs are offline-friendly; if the combined
// language pack can't load we fall back to English so OCR still works.
// ─────────────────────────────────────────────────────────────────────────────

const OCR_CACHE_PATH = path.resolve(__dirname, '../../..', '.ocr-cache');
const OCR_LANGS = process.env.OCR_LANGS || 'eng+vie';

interface TesseractWorker {
  recognize: (image: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
}

export interface OcrResult {
  text: string;
  /** 0-100, length-weighted across pages. */
  confidence: number;
}

async function createOcrWorker(): Promise<TesseractWorker> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createWorker } = require('tesseract.js');
  const options = { cachePath: OCR_CACHE_PATH };
  try {
    return (await createWorker(OCR_LANGS, 1, options)) as TesseractWorker;
  } catch (error) {
    logger.warn(
      `OCR: could not load languages "${OCR_LANGS}" (${(error as Error).message}); falling back to eng`,
    );
    return (await createWorker('eng', 1, options)) as TesseractWorker;
  }
}

/** OCR a list of page images and return the concatenated text + mean confidence. */
export async function ocrImages(images: Buffer[]): Promise<OcrResult> {
  if (images.length === 0) return { text: '', confidence: 0 };

  let worker: TesseractWorker;
  try {
    worker = await createOcrWorker();
  } catch (error) {
    logger.error(`OCR worker initialisation failed: ${(error as Error).message}`);
    throw new AppError(
      'The OCR engine is unavailable right now. Try again later or upload a text-based file.',
      503,
    );
  }

  try {
    const texts: string[] = [];
    let weightedConfidence = 0;
    let totalLength = 0;
    for (const image of images) {
      const { data } = await worker.recognize(image);
      const text = (data.text || '').trim();
      texts.push(text);
      const length = Math.max(text.length, 1);
      weightedConfidence += (data.confidence || 0) * length;
      totalLength += length;
    }
    const confidence = totalLength > 0 ? Math.round(weightedConfidence / totalLength) : 0;
    return { text: texts.join('\n\n').trim(), confidence };
  } finally {
    await worker.terminate().catch(() => undefined);
  }
}

export async function ocrImage(image: Buffer): Promise<OcrResult> {
  return ocrImages([image]);
}
