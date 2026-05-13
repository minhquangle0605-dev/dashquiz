

import mammoth from 'mammoth';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { AppError } from '../../middlewares/errorHandler';

// TYPES

export interface ExtractedOption {
  label: 'A' | 'B' | 'C' | 'D';
  content: string;
  isCorrect: boolean;
}

export interface ExtractedQuestion {
  content: string;
  questionType: 'SINGLE_CHOICE';
  difficulty: number;
  explanation: string | null;
  options: ExtractedOption[];
  /**
   * Diagnostic info — surfaced to the UI so the teacher
   * knows which items still need fixes before saving.
   */
  warnings: string[];
}

export interface ExtractionResult {

  rawTextPreview: string;

  source: 'openai' | 'regex';

  questions: ExtractedQuestion[];

  warnings: string[];
}


// FILE → TEXT


const DOCX_MIMETYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const PDF_MIMETYPES = new Set(['application/pdf']);

export function isSupportedDocumentMime(mime: string, filename = ''): boolean {
  if (DOCX_MIMETYPES.has(mime) || PDF_MIMETYPES.has(mime)) return true;
  const lower = filename.toLowerCase();
  return lower.endsWith('.docx') || lower.endsWith('.doc') || lower.endsWith('.pdf');
}

async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return (result.value || '').trim();
}

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2 ships as ESM; require it dynamically so this file can stay CJS.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('pdf-parse');
  const PDFParse = mod.PDFParse || mod.default?.PDFParse || mod.default;
  if (!PDFParse) {
    throw new AppError('pdf-parse module is not available', 500);
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return (result?.text || '').trim();
}

export async function extractTextFromDocument(
  buffer: Buffer,
  mimetype: string,
  filename = '',
): Promise<string> {
  const lower = filename.toLowerCase();
  if (DOCX_MIMETYPES.has(mimetype) || lower.endsWith('.docx') || lower.endsWith('.doc')) {
    return extractTextFromDocx(buffer);
  }
  if (PDF_MIMETYPES.has(mimetype) || lower.endsWith('.pdf')) {
    return extractTextFromPdf(buffer);
  }
  throw new AppError(
    'Unsupported file type. Please upload a .docx or .pdf file.',
    400,
  );
}

// ─────────────────────────────────────────────
// REGEX PARSER (no-AI fallback)
// ─────────────────────────────────────────────

/**
 * Splits raw text into question blocks. We look for markers like:
 *   - "Câu 1:" / "Câu 1." / "Câu 1)"
 *   - "Question 1:" / "Q1." / "1." / "1)"
 *   - "Bài 1:" / "Problem 1:"
 *
 * Each block is then parsed individually.
 */
function splitIntoQuestionBlocks(text: string): string[] {
  const normalized = text
    .replace(/\r\n?/g, '\n')
    // ensure question markers always start a new line
    .replace(/([^\n])(C[âa]u|Question|Q|B[àa]i|Problem)\s*\d+[\.:)]/gi, '$1\n$2')
    .trim();

  // Capture each "Câu N", "Question N", "Bài N", or bare "N." marker that begins a line.
  const splitRegex =
    /(?=^\s*(?:C[âa]u|Question|Q|B[àa]i|Problem)\s*\d+[\.:)]|^\s*\d+[\.:)]\s)/gim;

  const parts = normalized
    .split(splitRegex)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // If no markers were found at all, treat the whole document as a single block.
  if (parts.length === 0 && normalized.length > 0) return [normalized];
  return parts;
}

/**
 * Parses a single question block:
 *   Câu 1: <stem>
 *   A. <opt> / A) <opt> / A: <opt>
 *   B. ...
 *   C. ...
 *   D. ...
 *   Đáp án: B   (any of: Đáp án|Answer|Correct|ĐA|Key|Đ/A)
 *   Giải thích: ... (optional)
 */
function parseQuestionBlock(block: string): ExtractedQuestion | null {
  const warnings: string[] = [];

  // -- 1. Format the block's overall layout to ensure options are split properly --
  // We use a robust regex to find the last A. followed by B., C., D. in sequence.
  // This handles OMML fractions and complex spacing safely.
  const optionsRegex = /^(.*)(?:^|\s)(A[\.\):\-]\s+.*?)(?:\s)(B[\.\):\-]\s+.*?)(?:\s)(C[\.\):\-]\s+.*?)(?:\s)(D[\.\):\-]\s+.*)$/is;
  const match = block.match(optionsRegex);

  let formattedBlock = block;
  if (match) {
    const [_, stem, optA, optB, optC, optD] = match;
    formattedBlock = `${stem.trim()}\n${optA.trim()}\n${optB.trim()}\n${optC.trim()}\n${optD.trim()}`;
  }

  // -- 2. Preprocess lines to split inline explanation markers and fallback options --
  let rawLines = formattedBlock.split('\n').map((l) => l.trim());
  const expandedLines: string[] = [];

  for (let line of rawLines) {
    if (!line) continue;

    // Split inline explanation/answer markers first
    line = line.replace(
      /\s+(Đ[áa]p\s*[áa]n|Answer|Correct|Key|Đ\/A|ĐA|Đ\.A|Đáp án đúng)\s*[:.\-]\s*([A-D])\b/gi,
      '\n$1: $2'
    );
    line = line.replace(
      /\s+(Gi[ảa]i\s*th[íi]ch|Explanation|Lời\s*gi[ảa]i|Solution|Ch[úu]\s*th[íi]ch)\s*[:.\-]/gi,
      '\n$1:'
    );

    const sublines = line.split('\n').map((l) => l.trim()).filter(Boolean);

    for (let sub of sublines) {
      const isOptionLine = /^\s*([A-D])[\.\):\-]\s+/i.test(sub);
      const splitRegex = isOptionLine
        ? /\s+([A-D])[\.\):\-]\s+/gi
        : /\s{2,}([A-D])[\.\):\-]\s+/gi;

      const splitSub = sub.replace(splitRegex, '\n$1. ');
      expandedLines.push(...splitSub.split('\n').map((l) => l.trim()).filter(Boolean));
    }
  }

  const lines = expandedLines;

  // Strip leading question marker from the first line ("Câu 1:" etc.)
  let stem = (lines[0] || '').replace(
    /^(?:C[âa]u|Question|Q|B[àa]i|Problem)?\s*\d+\s*[\.:)]\s*/i,
    '',
  );
  const rest: string[] = [];

  // Find the line where options start
  const optionLineRegex = /^\s*([A-Da-d])\s*[\.\):\-]\s*(.+)$/;
  let optionsStarted = false;
  const options: Record<string, string> = {};
  let lastOption: string | null = null;

  let answerLine: string | null = null;
  let explanationLines: string[] = [];
  let captureExplanation = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      if (captureExplanation) explanationLines.push('');
      continue;
    }

    // Detect explicit answer marker
    const ansMatch = line.match(
      /^\s*(?:Đ[áa]p\s*[áa]n|Answer|Correct|Key|Đ\/A|ĐA|Đ\.A|Đáp án đúng)\s*[:.\-]\s*([A-Da-d])\b/i,
    );
    if (ansMatch) {
      answerLine = ansMatch[1].toUpperCase();
      captureExplanation = false;
      continue;
    }

    // Detect explanation marker
    const explMatch = line.match(
      /^\s*(?:Gi[ảa]i\s*th[íi]ch|Explanation|Lời\s*gi[ảa]i|Solution|Ch[úu]\s*th[íi]ch)\s*[:.\-]\s*(.*)$/i,
    );
    if (explMatch) {
      captureExplanation = true;
      if (explMatch[1]) explanationLines.push(explMatch[1]);
      continue;
    }

    const optMatch = line.match(optionLineRegex);
    if (optMatch) {
      optionsStarted = true;
      captureExplanation = false;
      const label = optMatch[1].toUpperCase();
      const content = optMatch[2].trim();
      options[label] = content;
      lastOption = label;
      continue;
    }

    if (!optionsStarted) {
      // still part of the stem
      rest.push(line);
    } else if (captureExplanation) {
      explanationLines.push(line);
    } else if (lastOption) {
      // continuation of the previous option (wrapped line)
      options[lastOption] = (options[lastOption] + ' ' + line).trim();
    }
  }

  if (rest.length > 0) {
    stem = (stem + ' ' + rest.join(' ')).trim();
  }
  stem = stem.replace(/\s+/g, ' ').trim();

  if (!stem) return null;

  // Build options
  const labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
  const builtOptions: ExtractedOption[] = labels.map((label) => ({
    label,
    content: options[label] || '',
    isCorrect: false,
  }));

  // Detect underline / bold markers used to indicate the correct option in some Word docs:
  //   "B. <answer>*"  or  "**B. answer**"  or  trailing "(*)"
  if (!answerLine) {
    for (const opt of builtOptions) {
      if (/\*$|\(\*\)\s*$|✔|✓/.test(opt.content)) {
        answerLine = opt.label;
        opt.content = opt.content.replace(/[*✔✓]+\s*$|\(\*\)\s*$/g, '').trim();
        break;
      }
    }
  }

  const missing = builtOptions.filter((o) => !o.content).map((o) => o.label);
  if (missing.length > 0) {
    warnings.push(`Missing option(s): ${missing.join(', ')}`);
  }

  if (answerLine && labels.includes(answerLine as 'A')) {
    const target = builtOptions.find((o) => o.label === answerLine);
    if (target) target.isCorrect = true;
  } else {
    warnings.push(
      'Correct answer not detected — please select one before saving.',
    );
  }

  const explanation = explanationLines.join(' ').trim() || null;

  return {
    content: stem,
    questionType: 'SINGLE_CHOICE',
    difficulty: 3,
    explanation,
    options: builtOptions,
    warnings,
  };
}

function regexExtract(text: string): ExtractedQuestion[] {
  return splitIntoQuestionBlocks(text)
    .map(parseQuestionBlock)
    .filter((q): q is ExtractedQuestion => q !== null);
}


// OPENAI PARSER


const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

async function openaiExtract(text: string): Promise<ExtractedQuestion[] | null> {
  if (!env.openai.apiKey) return null;

  // Cap the input — most quizzes fit comfortably in this budget.
  const MAX_CHARS = 18000;
  const trimmed = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;

  const systemPrompt = [
    'You convert raw exam text (Vietnamese or English) into JSON multiple-choice questions.',
    'Output JSON ONLY with this shape:',
    '{"questions":[{"content":"...","options":[{"label":"A","content":"...","isCorrect":true|false}, ... 4 entries],"explanation":"..."|null,"difficulty":1-5}]}',
    'Rules:',
    '- Always produce exactly 4 options labelled A, B, C, D in that order.',
    '- Exactly one option must have isCorrect=true.',
    '- If the document does not indicate the correct answer, pick the most plausible one and set isCorrect=true for it.',
    '- Strip prefixes like "Câu 1:", "A.", "Đáp án:" from option/content fields.',
    '- difficulty is an integer 1-5; default to 3 when unknown.',
    '- Keep math/chemistry notation as-is.',
    '- Return ONLY raw JSON, no markdown fences, no commentary.',
  ].join('\n');

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.openai.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmed },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.warn(`OpenAI extraction failed (${response.status})`);
      return null;
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { questions?: unknown };
    if (!parsed || !Array.isArray(parsed.questions)) return null;

    const normalized: ExtractedQuestion[] = [];
    for (const raw of parsed.questions as Array<Record<string, unknown>>) {
      const stem = String((raw.content as string) || '').trim();
      if (!stem) continue;
      const optsRaw = Array.isArray(raw.options) ? raw.options : [];
      const labels: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D'];
      const options: ExtractedOption[] = labels.map((label, idx) => {
        const o = (optsRaw[idx] as Record<string, unknown>) || {};
        return {
          label,
          content: String((o.content as string) || '').trim(),
          isCorrect: Boolean(o.isCorrect),
        };
      });
      // Force exactly one correct
      const correctCount = options.filter((o) => o.isCorrect).length;
      const warnings: string[] = [];
      if (correctCount !== 1) {
        // Trust the first one if multiple; mark warning so teacher checks.
        for (const o of options) o.isCorrect = false;
        const first = options.find((o) => o.content) || options[0];
        first.isCorrect = true;
        warnings.push('AI returned ambiguous answer — please verify.');
      }
      if (options.some((o) => !o.content)) {
        warnings.push('One or more options were empty — review needed.');
      }
      let difficulty = Number(raw.difficulty);
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) {
        difficulty = 3;
      }
      const explanation =
        typeof raw.explanation === 'string' && raw.explanation.trim()
          ? raw.explanation.trim()
          : null;

      normalized.push({
        content: stem,
        questionType: 'SINGLE_CHOICE',
        difficulty,
        explanation,
        options,
        warnings,
      });
    }
    return normalized;
  } catch (err) {
    logger.warn(`OpenAI extraction error: ${(err as Error).message}`);
    return null;
  }
}


// PUBLIC API


export class QuestionExtractService {
  async extractFromDocument(
    buffer: Buffer,
    mimetype: string,
    filename = '',
  ): Promise<ExtractionResult> {
    const text = await extractTextFromDocument(buffer, mimetype, filename);
    if (!text) {
      throw new AppError(
        'Could not extract any text from this file. Is it a scanned image PDF?',
        400,
      );
    }

    const warnings: string[] = [];
    let questions: ExtractedQuestion[] = [];
    let source: 'openai' | 'regex' = 'regex';

    if (env.openai.apiKey) {
      const aiResult = await openaiExtract(text);
      if (aiResult && aiResult.length > 0) {
        questions = aiResult;
        source = 'openai';
      } else {
        warnings.push(
          'AI parser was unavailable or returned no questions — used heuristic fallback.',
        );
        questions = regexExtract(text);
      }
    } else {
      questions = regexExtract(text);
    }

    if (questions.length === 0) {
      warnings.push(
        'No questions detected. Make sure the document uses "Câu 1:" / "A." / "Đáp án:" style markers.',
      );
    }

    const rawTextPreview = text.length > 4000 ? text.slice(0, 4000) + '…' : text;

    return {
      rawTextPreview,
      source,
      questions,
      warnings,
    };
  }
}

export const questionExtractService = new QuestionExtractService();
