import JSZip from 'jszip';
import { AppError } from '../../middlewares/errorHandler';
import { FILE_UPLOAD } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { detectImageMime, uploadQuestionImageBuffer } from './question.media';
import type { ExtractedQuestionKind } from './question.extract.service';

// ═══════════════════════════════════════════════
// LIMITS
// ═══════════════════════════════════════════════

const MAX_QUESTIONS = 500;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;
const ALLOWED_IMAGE_MIMES = FILE_UPLOAD.ALLOWED_IMAGE_TYPES as readonly string[];

// ═══════════════════════════════════════════════
// PREVIEW TYPES (mirror ExtractedQuestion + inline image URLs)
// ═══════════════════════════════════════════════

export interface ZipImportOption {
  label: string;
  content: string;
  isCorrect: boolean;
  imageUrl: string | null;
}

export interface ZipImportQuestion {
  content: string;
  questionType: ExtractedQuestionKind;
  difficulty: number;
  explanation: string | null;
  options: ZipImportOption[];
  warnings: string[];
  errors: string[];
  questionImageUrl: string | null;
  explanationImageUrl: string | null;
}

export interface ZipImportResult {
  source: 'zip';
  questions: ZipImportQuestion[];
  warnings: string[];
  total: number;
  valid: number;
  invalid: number;
}

// ═══════════════════════════════════════════════
// RAW JSON SHAPES (loosely typed — validated manually for friendly errors)
// ═══════════════════════════════════════════════

interface RawOption {
  label?: string | number;
  text?: string | number | null;
  // Moodle-style HTML aliases for the option body.
  content_html?: string | number | null;
  html?: string | number | null;
  image?: string | null;
  // Per-option correctness flag (alternative to the top-level correct_answer).
  is_correct?: boolean;
  isCorrect?: boolean;
}

interface RawQuestion {
  id?: string | number;
  type?: string;
  question_text?: string | number;
  // Moodle-style HTML aliases for the question stem.
  content_html?: string | number;
  content?: string | number;
  html?: string | number;
  question_image?: string | null;
  options?: RawOption[];
  correct_answer?: string | number | Array<string | number>;
  explanation?: string | null;
  explanation_image?: string | null;
  difficulty?: string | number;
}

/** First non-empty rich-text/plain-text field among the given aliases. */
function pickText(...values: Array<string | number | null | undefined>): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

const INLINE_IMG_TAG = /<img\b[^>]*?\ssrc\s*=\s*(['"])(.*?)\1[^>]*>/gi;
const ALREADY_RESOLVED_SRC = /^(https?:|data:|\/api\/questions\/images\/)/i;

function letterFromIndex(index: number): string {
  return String.fromCharCode('A'.charCodeAt(0) + index);
}

function normalizeImagePath(ref: string): string {
  return ref
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function mapDifficulty(raw: string | number | undefined): number {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 1 && raw <= 5) {
    return raw;
  }
  const value = String(raw ?? '').trim().toLowerCase();
  if (/^[1-5]$/.test(value)) return Number(value);
  switch (value) {
    case 'very easy':
      return 1;
    case 'easy':
      return 2;
    case 'medium':
    case 'normal':
      return 3;
    case 'hard':
      return 4;
    case 'very hard':
      return 5;
    default:
      return 3;
  }
}

function mapQuestionType(
  raw: string | undefined,
  correctCount: number,
): ExtractedQuestionKind {
  const value = String(raw ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  if (value === 'singlechoice' || value === 'single' || value === 'mcq') {
    return 'SINGLE_CHOICE';
  }
  if (value === 'truefalse' || value === 'tf' || value === 'boolean') {
    return 'TRUE_FALSE';
  }
  if (value === 'shortanswer' || value === 'sa' || value === 'fillblank') {
    return 'SHORT_ANSWER';
  }
  if (value === 'matching' || value === 'match') {
    return 'MATCHING';
  }
  // 'multiplechoice' or unknown → infer from how many answers are correct
  return correctCount > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE';
}

// ═══════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════

class QuestionZipService {
  /**
   * Parse a ZIP bundle (questions.json + images/), validate every question,
   * upload referenced images to MinIO and return a preview. Per-question errors
   * are collected (never thrown) so the teacher can review, fix and partially
   * import valid questions — the actual save still goes through bulk-create.
   */
  async importFromZip(buffer: Buffer, userId: number): Promise<ZipImportResult> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch {
      throw new AppError('Invalid or corrupted ZIP file', 400);
    }

    // Locate questions.json (prefer the shallowest path / archive root).
    const jsonEntry = Object.values(zip.files)
      .filter((f) => !f.dir && basename(f.name).toLowerCase() === 'questions.json')
      .sort((a, b) => a.name.split('/').length - b.name.split('/').length)[0];

    if (!jsonEntry) {
      throw new AppError('questions.json was not found inside the ZIP', 400);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(await jsonEntry.async('string'));
    } catch {
      throw new AppError('questions.json contains invalid JSON', 400);
    }

    const rawQuestions: RawQuestion[] = Array.isArray(parsed)
      ? (parsed as RawQuestion[])
      : Array.isArray((parsed as { questions?: unknown })?.questions)
        ? ((parsed as { questions: RawQuestion[] }).questions)
        : [];

    if (rawQuestions.length === 0) {
      throw new AppError('questions.json must be a non-empty array of questions', 400);
    }
    if (rawQuestions.length > MAX_QUESTIONS) {
      throw new AppError(`Too many questions: ${rawQuestions.length}. Max ${MAX_QUESTIONS} per import.`, 400);
    }

    // Index image entries by normalized path and by basename (fallback).
    const imageByPath = new Map<string, JSZip.JSZipObject>();
    const imageByBasename = new Map<string, JSZip.JSZipObject>();
    for (const file of Object.values(zip.files)) {
      if (file.dir || !IMAGE_EXT.test(file.name)) continue;
      const normalized = normalizeImagePath(file.name).toLowerCase();
      imageByPath.set(normalized, file);
      imageByBasename.set(basename(normalized), file);
    }

    // Upload-once cache keyed by normalized ref.
    const uploadCache = new Map<string, string>();
    const warnings: string[] = [];

    const resolveImage = async (
      ref: string | null | undefined,
    ): Promise<{ url: string | null; error: string | null }> => {
      if (ref === null || ref === undefined || String(ref).trim() === '') {
        return { url: null, error: null };
      }
      const normalized = normalizeImagePath(String(ref));
      if (normalized.split('/').some((seg) => seg === '..')) {
        return { url: null, error: `Unsafe image path "${ref}"` };
      }
      const cacheKey = normalized.toLowerCase();
      if (uploadCache.has(cacheKey)) {
        return { url: uploadCache.get(cacheKey)!, error: null };
      }
      const entry =
        imageByPath.get(cacheKey) ?? imageByBasename.get(basename(cacheKey));
      if (!entry) {
        return { url: null, error: `Image "${ref}" not found in the ZIP` };
      }
      const bytes = await entry.async('nodebuffer');
      if (bytes.length > FILE_UPLOAD.MAX_QUESTION_IMAGE_SIZE) {
        return { url: null, error: `Image "${ref}" exceeds the 5MB limit` };
      }
      const mime = detectImageMime(bytes);
      if (!mime || !ALLOWED_IMAGE_MIMES.includes(mime)) {
        return { url: null, error: `Image "${ref}" is not a valid JPG, PNG or WebP file` };
      }
      try {
        const { url } = await uploadQuestionImageBuffer(userId, bytes, mime, bytes.length);
        uploadCache.set(cacheKey, url);
        return { url, error: null };
      } catch (error) {
        logger.error('ZIP import image upload failed', { ref, error });
        return { url: null, error: `Failed to store image "${ref}"` };
      }
    };

    /**
     * Rewrite inline <img src="images/..."> references inside a rich-HTML field
     * (question stem / option body / explanation) to their uploaded URLs, as the
     * plan requires. Already-resolved srcs (http(s):, data:, or an existing
     * /api/questions/images/ URL) are left untouched. Resolution problems are
     * pushed onto the supplied errors array. The first correct-answer label set
     * is unaffected — only the HTML text is changed.
     */
    const rewriteInlineImages = async (
      html: string,
      errors: string[],
    ): Promise<string> => {
      if (!html || !/<img/i.test(html)) return html;
      const refs = new Set<string>();
      let match: RegExpExecArray | null;
      INLINE_IMG_TAG.lastIndex = 0;
      while ((match = INLINE_IMG_TAG.exec(html)) !== null) {
        const src = match[2].trim();
        if (src && !ALREADY_RESOLVED_SRC.test(src)) refs.add(src);
      }
      if (refs.size === 0) return html;

      const resolved = new Map<string, string>();
      for (const ref of refs) {
        const { url, error } = await resolveImage(ref);
        if (error) errors.push(error);
        if (url) resolved.set(ref, url);
      }

      INLINE_IMG_TAG.lastIndex = 0;
      return html.replace(INLINE_IMG_TAG, (tag, _quote, src) => {
        const url = resolved.get(String(src).trim());
        return url ? tag.replace(src, url) : tag;
      });
    };

    const questions: ZipImportQuestion[] = [];

    for (let i = 0; i < rawQuestions.length; i++) {
      const raw = rawQuestions[i] ?? {};
      const errors: string[] = [];

      // Question stem: accept question_text or the Moodle-style content_html / html / content,
      // then rewrite any inline <img src="images/..."> references to uploaded URLs.
      const content = await rewriteInlineImages(
        pickText(raw.question_text, raw.content_html, raw.content, raw.html),
        errors,
      );
      if (!content) errors.push('Question content is empty.');

      // ── Correct-answer labels ──
      const correctRaw = Array.isArray(raw.correct_answer)
        ? raw.correct_answer.map((c) => String(c))
        : String(raw.correct_answer ?? '').split(/[,;]/);
      const correctTokens = correctRaw.map((c) => c.trim()).filter(Boolean);

      // ── Options ──
      const rawOptions = Array.isArray(raw.options) ? raw.options : [];
      const optionLabels: string[] = rawOptions.map((opt, idx) => {
        const label = String(opt?.label ?? '').trim().toUpperCase();
        return /^[A-Z]$/.test(label) ? label : letterFromIndex(idx);
      });
      // Option body: accept text or the Moodle-style content_html / html.
      const optionTexts: string[] = rawOptions.map((opt) =>
        pickText(opt?.text, opt?.content_html, opt?.html),
      );

      // Map each correct token to a concrete option label (letter or by text).
      const correctLabels = new Set<string>();
      for (const token of correctTokens) {
        const upper = token.toUpperCase();
        if (/^[A-Z]$/.test(upper) && optionLabels.includes(upper)) {
          correctLabels.add(upper);
          continue;
        }
        const byText = optionTexts.findIndex(
          (text) => text.toLowerCase() === token.toLowerCase(),
        );
        if (byText >= 0) {
          correctLabels.add(optionLabels[byText]);
        }
      }
      // Also honour the plan's per-option is_correct flag (Moodle-style bundles
      // that omit a top-level correct_answer).
      rawOptions.forEach((opt, idx) => {
        if (opt?.is_correct === true || opt?.isCorrect === true) {
          correctLabels.add(optionLabels[idx]);
        }
      });

      const correctCount = correctLabels.size;
      const questionType = mapQuestionType(raw.type, correctCount);

      const isChoice =
        questionType === 'SINGLE_CHOICE' ||
        questionType === 'MULTIPLE_CHOICE' ||
        questionType === 'TRUE_FALSE';

      // Validate structure (collect, don't throw).
      if (rawOptions.length === 0) {
        errors.push('No options were provided.');
      }
      const seen = new Set<string>();
      for (const label of optionLabels) {
        if (seen.has(label)) errors.push(`Duplicate option label "${label}".`);
        seen.add(label);
      }
      rawOptions.forEach((opt, idx) => {
        const hasInlineImage = /<img/i.test(optionTexts[idx]);
        if (!optionTexts[idx] && !opt?.image && !hasInlineImage) {
          errors.push(`Option ${optionLabels[idx]} is empty.`);
        }
      });
      if (isChoice && correctCount === 0) {
        errors.push(
          raw.correct_answer
            ? `correct_answer "${String(raw.correct_answer)}" does not match any option.`
            : 'No correct answer was specified (set correct_answer or is_correct on an option).',
        );
      }
      if ((questionType === 'SINGLE_CHOICE' || questionType === 'TRUE_FALSE') && correctCount > 1) {
        errors.push('Only one correct answer is allowed for this question type.');
      }

      // ── Resolve images ──
      const questionImage = await resolveImage(raw.question_image);
      if (questionImage.error) errors.push(questionImage.error);

      const explanationImage = await resolveImage(raw.explanation_image);
      if (explanationImage.error) errors.push(explanationImage.error);

      const options: ZipImportOption[] = [];
      for (let j = 0; j < rawOptions.length; j++) {
        const optImage = await resolveImage(rawOptions[j]?.image);
        if (optImage.error) errors.push(optImage.error);
        const label = optionLabels[j];
        options.push({
          label,
          content: await rewriteInlineImages(optionTexts[j], errors),
          isCorrect: questionType === 'SHORT_ANSWER' || questionType === 'MATCHING'
            ? true
            : correctLabels.has(label),
          imageUrl: optImage.url,
        });
      }

      questions.push({
        content,
        questionType,
        difficulty: mapDifficulty(raw.difficulty),
        explanation: raw.explanation
          ? await rewriteInlineImages(String(raw.explanation).trim(), errors)
          : null,
        options,
        warnings: [],
        errors,
        questionImageUrl: questionImage.url,
        explanationImageUrl: explanationImage.url,
      });
    }

    const invalid = questions.filter((q) => q.errors.length > 0).length;

    return {
      source: 'zip',
      questions,
      warnings,
      total: questions.length,
      valid: questions.length - invalid,
      invalid,
    };
  }

  /**
   * Build a downloadable sample ZIP (questions.json + images/sample.png) that
   * documents the expected import format for the teacher.
   */
  async generateTemplateZip(): Promise<Buffer> {
    const zip = new JSZip();

    const sample = [
      {
        id: 'Q001',
        type: 'multiple_choice',
        question_text: 'Based on the diagram, what is the measure of each angle in the triangle?',
        question_image: 'images/sample.png',
        options: [
          { label: 'A', text: '30 degrees', image: null },
          { label: 'B', text: '45 degrees', image: null },
          { label: 'C', text: '60 degrees', image: null },
          { label: 'D', text: '90 degrees', image: null },
        ],
        correct_answer: 'C',
        explanation: 'An equilateral triangle has three equal angles of 60 degrees.',
        explanation_image: null,
        subject: 'Mathematics',
        grade: '10',
        topic: 'Geometry',
        difficulty: 'medium',
      },
      {
        id: 'Q002',
        type: 'multiple_choice',
        question_text: 'Which element has the atomic number 6?',
        question_image: null,
        options: [
          { label: 'A', text: 'Nitrogen' },
          { label: 'B', text: 'Oxygen' },
          { label: 'C', text: 'Carbon' },
          { label: 'D', text: 'Boron' },
        ],
        correct_answer: 'C',
        explanation: 'Carbon (C) has the atomic number 6.',
        difficulty: 1,
      },
      {
        // Moodle-style format: HTML stem with an inline <img>, and the correct
        // answer marked per option with is_correct (no top-level correct_answer).
        id: 'Q003',
        type: 'single_choice',
        content_html:
          '<p>Given the pyramid S.ABCD shown below, which statement is correct?</p><img src="images/sample.png" />',
        options: [
          { label: 'A', content_html: '<p>Statement is wrong</p>', is_correct: false },
          { label: 'B', content_html: '<p>Statement is also wrong</p>', is_correct: false },
          { label: 'C', content_html: '<p>Statement is correct</p>', is_correct: true },
          { label: 'D', content_html: '<p>None of the above</p>', is_correct: false },
        ],
        difficulty: 'medium',
      },
    ];

    const readme = [
      'HOW TO IMPORT QUESTIONS WITH IMAGES',
      '====================================',
      '',
      '1. Edit questions.json (an array of questions).',
      '2. Put every image inside the images/ folder.',
      '3. Reference an image by its path, e.g. "images/my_picture.png".',
      '4. Zip questions.json together with the images/ folder and upload it.',
      '',
      'Each question accepts EITHER of two equivalent styles:',
      '',
      'A) Structured style (recommended, shows image thumbnails in the preview):',
      '  question_text     (required) the question stem (plain text)',
      '  question_image    (optional) image path inside the ZIP',
      '  options[].label   A, B, C, D ... (optional, auto-assigned if omitted)',
      '  options[].text    (required) the option text',
      '  options[].image   (optional) image path for that option',
      '  correct_answer    (required) e.g. "C" or "A,C" for multiple correct',
      '  explanation       (optional) answer explanation',
      '  explanation_image (optional) image path for the explanation',
      '  difficulty        (optional) 1-5 or easy/medium/hard (default medium)',
      '',
      'B) Moodle/HTML style (see question Q003 in the sample):',
      '  content_html        the question stem as HTML; inline',
      '                      <img src="images/your_picture.png" /> paths are',
      '                      rewritten to stored URLs automatically.',
      '  options[].content_html  the option body as HTML (inline images allowed).',
      '  options[].is_correct    true/false per option (instead of correct_answer).',
      '',
      'Allowed image types: PNG, JPG/JPEG, WebP. Max 5MB per image, 500 questions per ZIP.',
      'Subject / grade / chapter are chosen on the import screen, not in this file.',
    ].join('\n');

    // Minimal valid 1x1 PNG so the sample question shows a real image.
    const samplePng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    zip.file('questions.json', JSON.stringify(sample, null, 2));
    zip.file('README.txt', readme);
    zip.folder('images')?.file('sample.png', samplePng);

    return zip.generateAsync({ type: 'nodebuffer' });
  }
}

export const questionZipService = new QuestionZipService();
