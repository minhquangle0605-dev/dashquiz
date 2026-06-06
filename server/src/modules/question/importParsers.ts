import * as XLSX from 'xlsx';
import { AppError } from '../../middlewares/errorHandler';
import { questionExtractService, extractTextFromDocument } from './question.extract.service';
import { questionZipService } from './question.zip.service';
import { ocrImage, ocrImages } from './ocr.service';
import { renderPdfToImages } from './pdfRender';
import type { NormalizedImportQuestion } from './importValidation';
import type { ExtractedQuestion } from './question.extract.service';

// ─────────────────────────────────────────────────────────────────────────────
// IMPORT PARSERS (PDF §7 "Text and layout extraction")
//
// Parse-only adapters that turn an uploaded file into normalized questions WITHOUT
// saving anything. Excel is parsed here; DOCX/PDF/TXT/GIFT reuse the existing
// extraction service and ZIP reuses the existing ZIP service (which also uploads
// referenced images). The output feeds the validation engine + preview items.
// The legacy synchronous import endpoints are left untouched.
// ─────────────────────────────────────────────────────────────────────────────

export type ImportSourceFormat = 'excel' | 'document' | 'zip' | 'image';

export interface ParsedImportItem {
  question: NormalizedImportQuestion;
  rawText: string | null;
  sourceLine: number | null;
  sourcePage: number | null;
  baseConfidence: number;
}

export interface ParseResult {
  items: ParsedImportItem[];
  parserSource: string; // excel | regex | openai | zip
  warnings: string[];
}

const EXCEL_HEADERS = ['content', 'A', 'B', 'C', 'D', 'correct', 'explanation', 'difficulty'] as const;

const EXCEL_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
]);
const ZIP_MIMES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'multipart/x-zip',
]);
const DOCUMENT_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/pdf',
  'text/plain',
  'application/gift',
]);
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

const MIN_PDF_TEXT_FOR_LAYER = 80; // below this a PDF is treated as scanned → OCR

/** Decide which parser to use from the MIME type, falling back to the extension. */
export function detectSourceFormat(mimetype: string, filename: string): ImportSourceFormat {
  const name = (filename || '').toLowerCase();
  if (ZIP_MIMES.has(mimetype) || name.endsWith('.zip')) return 'zip';
  if (EXCEL_MIMES.has(mimetype) || name.endsWith('.xlsx') || name.endsWith('.xls')) return 'excel';
  if (IMAGE_MIMES.has(mimetype) || /\.(png|jpe?g|webp)$/i.test(name)) return 'image';
  if (
    DOCUMENT_MIMES.has(mimetype) ||
    name.endsWith('.docx') ||
    name.endsWith('.doc') ||
    name.endsWith('.pdf') ||
    name.endsWith('.txt') ||
    name.endsWith('.gift')
  ) {
    return 'document';
  }
  // application/octet-stream and friends: trust the extension only.
  throw new AppError(
    'Unsupported file type. Upload Excel, Word/PDF/TXT/GIFT, an image (PNG/JPG/WebP), or a ZIP bundle.',
    400,
  );
}

/** Map extracted questions (from text layer or OCR) into normalized preview items. */
function mapExtractedQuestions(questions: ExtractedQuestion[], baseConfidence: number): ParsedImportItem[] {
  return questions.map((q) => ({
    question: {
      content: q.content,
      questionType: q.questionType,
      difficulty: q.difficulty,
      explanation: q.explanation,
      options: q.options.map((o) => ({
        label: o.label,
        content: o.content,
        isCorrect: o.isCorrect,
        imageUrl: null,
      })),
      questionImageUrl: null,
      explanationImageUrl: null,
    },
    rawText: q.sourceText ?? null,
    sourceLine: q.sourceLine ?? null,
    sourcePage: null,
    baseConfidence,
  }));
}

function letterFromIndex(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function mapDifficulty(raw: unknown): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 3;
}

// ── Excel ────────────────────────────────────────────────────────────────────

function parseExcel(buffer: Buffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new AppError('Excel file has no sheets', 400);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: '',
  });
  if (rows.length === 0) throw new AppError('Excel file is empty', 400);

  const headers = Object.keys(rows[0] || {});
  const missing = EXCEL_HEADERS.filter(
    (h) => !headers.some((hdr) => hdr.toLowerCase().trim() === h.toLowerCase()),
  );
  if (missing.length > 0) {
    throw new AppError(
      `Missing required columns: ${missing.join(', ')}. Expected: ${EXCEL_HEADERS.join(', ')}`,
      400,
    );
  }

  const items: ParsedImportItem[] = [];
  rows.forEach((row, i) => {
    const get = (key: string): string => String(row[key] ?? '').trim();
    const content = get('content');
    const optA = get('A');
    const optB = get('B');
    const optC = get('C');
    const optD = get('D');

    // Skip rows that are completely blank (trailing template rows).
    if (!content && !optA && !optB && !optC && !optD) return;

    const correctRaw = get('correct').toUpperCase();
    const correct = new Set(
      correctRaw
        .split(/[,;]/)
        .map((c) => c.trim())
        .filter((c) => /^[A-D]$/.test(c)),
    );
    const questionType = correct.size > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE';

    items.push({
      question: {
        content,
        questionType,
        difficulty: mapDifficulty(row['difficulty']),
        explanation: get('explanation') || null,
        options: [
          { label: 'A', content: optA, isCorrect: correct.has('A') },
          { label: 'B', content: optB, isCorrect: correct.has('B') },
          { label: 'C', content: optC, isCorrect: correct.has('C') },
          { label: 'D', content: optD, isCorrect: correct.has('D') },
        ],
        questionImageUrl: null,
        explanationImageUrl: null,
      },
      rawText: content || null,
      sourceLine: i + 2, // 1-indexed + header row
      sourcePage: null,
      baseConfidence: 1,
    });
  });

  if (items.length === 0) throw new AppError('No data rows found in the Excel file', 400);
  return { items, parserSource: 'excel', warnings: [] };
}

// ── Word / PDF / TXT / GIFT ────────────────────────────────────────────────────

async function parseDocument(
  buffer: Buffer,
  mimetype: string,
  filename: string,
): Promise<ParseResult> {
  const isPdf = mimetype === 'application/pdf' || /\.pdf$/i.test(filename);
  const warnings: string[] = [];

  let text = '';
  try {
    text = await extractTextFromDocument(buffer, mimetype, filename);
  } catch {
    text = '';
  }

  // Scanned PDF (little/no text layer) → render pages and OCR them.
  let ocrConfidence: number | null = null;
  if (isPdf && text.trim().length < MIN_PDF_TEXT_FOR_LAYER) {
    try {
      const images = await renderPdfToImages(buffer);
      if (images.length > 0) {
        const ocr = await ocrImages(images);
        if (ocr.text.trim().length > text.trim().length) {
          text = ocr.text;
          ocrConfidence = ocr.confidence;
          warnings.push(
            `This PDF looked scanned, so text was recovered with OCR (~${ocr.confidence}% confidence). Please review every question carefully.`,
          );
        }
      }
    } catch (error) {
      warnings.push(
        error instanceof AppError ? error.message : 'OCR could not be run on this scanned PDF.',
      );
    }
  }

  if (!text.trim()) {
    return {
      items: [],
      parserSource: ocrConfidence !== null ? 'ocr' : 'regex',
      warnings: [...warnings, 'No text could be extracted from this file.'],
    };
  }

  const result = await questionExtractService.extractFromText(text);
  const baseConfidence =
    ocrConfidence !== null
      ? Math.max(0.3, ocrConfidence / 100)
      : result.source === 'openai'
        ? 0.85
        : 0.9;

  return {
    items: mapExtractedQuestions(result.questions, baseConfidence),
    parserSource: ocrConfidence !== null ? 'ocr' : result.source,
    warnings: [...warnings, ...result.warnings],
  };
}

// ── Image (PNG / JPG / WebP) → OCR ──────────────────────────────────────────────

async function parseImage(buffer: Buffer): Promise<ParseResult> {
  const ocr = await ocrImage(buffer);
  if (!ocr.text.trim()) {
    return {
      items: [],
      parserSource: 'ocr',
      warnings: ['No readable text was found in this image.'],
    };
  }
  const result = await questionExtractService.extractFromText(ocr.text);
  return {
    items: mapExtractedQuestions(result.questions, Math.max(0.3, ocr.confidence / 100)),
    parserSource: 'ocr',
    warnings: [
      `Text was read from the image with OCR (~${ocr.confidence}% confidence). Please review every question carefully.`,
      ...result.warnings,
    ],
  };
}

// ── ZIP (questions.json + images/) ──────────────────────────────────────────────

async function parseZip(buffer: Buffer, userId: number): Promise<ParseResult> {
  const result = await questionZipService.importFromZip(buffer, userId);
  const items: ParsedImportItem[] = result.questions.map((q) => ({
    question: {
      content: q.content,
      questionType: q.questionType,
      difficulty: q.difficulty,
      explanation: q.explanation,
      options: q.options.map((o) => ({
        label: o.label,
        content: o.content,
        isCorrect: o.isCorrect,
        imageUrl: o.imageUrl,
      })),
      questionImageUrl: q.questionImageUrl,
      explanationImageUrl: q.explanationImageUrl,
    },
    rawText: null,
    sourceLine: null,
    sourcePage: null,
    baseConfidence: 1,
  }));
  return { items, parserSource: 'zip', warnings: result.warnings };
}

/** Dispatch to the right parser based on the detected source format. */
export async function parseImportFile(
  format: ImportSourceFormat,
  buffer: Buffer,
  mimetype: string,
  filename: string,
  userId: number,
): Promise<ParseResult> {
  switch (format) {
    case 'excel':
      return parseExcel(buffer);
    case 'document':
      return parseDocument(buffer, mimetype, filename);
    case 'image':
      return parseImage(buffer);
    case 'zip':
      return parseZip(buffer, userId);
    default:
      throw new AppError('Unsupported import source', 400);
  }
}
