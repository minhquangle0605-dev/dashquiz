import { AppError } from '../../middlewares/errorHandler';
import { logger } from '../../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// PDF → IMAGE RASTERIZER (PDF §11 "Render pages to images and run OCR")
//
// Renders PDF pages to PNG buffers with pdfjs-dist + @napi-rs/canvas (prebuilt
// binary, no node-gyp). Used only when a PDF has no usable text layer (scanned).
// ─────────────────────────────────────────────────────────────────────────────

const RENDER_SCALE = 2; // 2x for sharper OCR input
const DEFAULT_MAX_PAGES = 20; // cap work for large scanned PDFs

// Import the ESM-only pdfjs legacy build from CommonJS without tripping TS module
// resolution (the .mjs subpath ships no usable types for our setup).
const importEsm = new Function('specifier', 'return import(specifier);') as (
  specifier: string,
) => Promise<any>;

/**
 * Rasterize up to `maxPages` pages of a PDF to PNG buffers. Throws a friendly
 * AppError if the renderer is unavailable; individual page failures are skipped.
 */
export async function renderPdfToImages(
  buffer: Buffer,
  maxPages = DEFAULT_MAX_PAGES,
): Promise<Buffer[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createCanvas } = require('@napi-rs/canvas');

  let pdfjs: any;
  try {
    pdfjs = await importEsm('pdfjs-dist/legacy/build/pdf.mjs');
  } catch (error) {
    logger.error(`pdfjs failed to load: ${(error as Error).message}`);
    throw new AppError('PDF rendering for OCR is unavailable on this server.', 503);
  }

  let doc: any;
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
  } catch (error) {
    logger.warn(`pdfjs could not open the PDF: ${(error as Error).message}`);
    throw new AppError('This PDF could not be opened for OCR.', 400);
  }

  const images: Buffer[] = [];
  const pageCount = Math.min(doc.numPages, maxPages);
  try {
    for (let i = 1; i <= pageCount; i++) {
      try {
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toBuffer('image/png'));
        page.cleanup();
      } catch (error) {
        logger.warn(`pdfjs failed to render page ${i}: ${(error as Error).message}`);
      }
    }
  } finally {
    await doc.destroy().catch(() => undefined);
  }

  return images;
}
