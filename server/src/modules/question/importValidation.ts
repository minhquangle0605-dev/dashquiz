// ─────────────────────────────────────────────────────────────────────────────
// IMPORT VALIDATION ENGINE (PDF §12)
//
// Single source of truth for "is this extracted question safe to save?". Every
// import source (Excel, DOCX/PDF, GIFT, ZIP, and later OCR) runs its normalized
// questions through validateImportQuestion(). Critical errors BLOCK commit;
// warnings are advisory. The same rule set mirrors what bulkCreate enforces at
// save time, so the preview is honest about what will and will not be accepted.
// ─────────────────────────────────────────────────────────────────────────────

export type ImportQuestionKind =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'MATCHING';

const QUESTION_KINDS: ReadonlySet<string> = new Set<ImportQuestionKind>([
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'MATCHING',
]);

export interface NormalizedImportOption {
  label: string;
  content: string;
  isCorrect: boolean;
  imageUrl?: string | null;
}

export interface NormalizedImportQuestion {
  content: string;
  questionType: ImportQuestionKind;
  difficulty: number;
  explanation: string | null;
  options: NormalizedImportOption[];
  questionImageUrl?: string | null;
  explanationImageUrl?: string | null;
}

export interface ValidationResult {
  /** Blocks commit until resolved. */
  critical: string[];
  /** Advisory; commit is still allowed. */
  warnings: string[];
  /** 0..1 — extraction/quality confidence, lowered by warnings & critical errors. */
  confidence: number;
}

const MIN_STEM_LENGTH = 8;

/** A choice-style question whose options carry the correct-answer flags. */
function isChoice(kind: ImportQuestionKind): boolean {
  return kind === 'SINGLE_CHOICE' || kind === 'MULTIPLE_CHOICE' || kind === 'TRUE_FALSE';
}

/** Strip HTML tags so length/emptiness checks reflect the real text content. */
function plainText(html: string): string {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitMatchingPair(content: string): { left: string; right: string } {
  const [left = '', ...rest] = String(content || '').split(/\s*=>\s*/);
  return { left: left.trim(), right: rest.join(' => ').trim() };
}

/**
 * Validate one normalized import question. Pure and deterministic — no DB access.
 * `baseConfidence` lets a parser seed an extraction confidence (e.g. OCR) that the
 * engine then discounts for every issue it finds.
 */
export function validateImportQuestion(
  q: NormalizedImportQuestion,
  baseConfidence = 1,
): ValidationResult {
  const critical: string[] = [];
  const warnings: string[] = [];

  const kind = q.questionType;
  const stem = plainText(q.content);
  const hasStemImage = Boolean(q.questionImageUrl) || /<img/i.test(q.content || '');

  // ── Question structure ──
  if (!QUESTION_KINDS.has(kind)) {
    critical.push(`Unknown question type "${String(kind)}".`);
  }
  if (!stem && !hasStemImage) {
    critical.push('Question content is empty.');
  } else if (stem && stem.length < MIN_STEM_LENGTH) {
    warnings.push('Question text looks very short — please double-check it.');
  }

  const options = Array.isArray(q.options) ? q.options : [];

  // ── Option labels (choice types use A–Z labels) ──
  if (isChoice(kind)) {
    const labels = options.map((o) => String(o.label || '').toUpperCase());
    const seen = new Set<string>();
    for (const label of labels) {
      if (!/^[A-Z]$/.test(label)) {
        critical.push('Option labels must be single letters A–Z.');
        break;
      }
    }
    for (const label of labels) {
      if (seen.has(label)) {
        critical.push(`Duplicate option label "${label}".`);
        break;
      }
      seen.add(label);
    }
  }

  // Options missing content (an inline/option image counts as content).
  options.forEach((o, idx) => {
    const text = plainText(o.content);
    const hasImage = Boolean(o.imageUrl) || /<img/i.test(o.content || '');
    if (!text && !hasImage) {
      const label = o.label || String.fromCharCode(65 + idx);
      critical.push(`Option ${label} is empty.`);
    }
  });

  const correctCount = options.filter((o) => o.isCorrect).length;

  // ── Per-type rules (mirror bulkCreate) ──
  switch (kind) {
    case 'SINGLE_CHOICE':
      if (options.length < 2) critical.push('Single choice needs at least two options.');
      if (correctCount === 0) critical.push('Select exactly one correct option.');
      if (correctCount > 1) critical.push('Single choice allows only one correct option.');
      break;
    case 'TRUE_FALSE':
      if (options.length !== 2) critical.push('True/False needs exactly two options.');
      if (correctCount !== 1) critical.push('Choose True or False as the correct answer.');
      break;
    case 'MULTIPLE_CHOICE':
      if (options.length < 2) critical.push('Multiple choice needs at least two options.');
      if (correctCount < 1) critical.push('Select at least one correct option.');
      if (correctCount === 1) {
        warnings.push('Only one correct option — consider Single choice instead.');
      }
      break;
    case 'SHORT_ANSWER':
      if (options.length < 1) critical.push('Add at least one accepted answer.');
      break;
    case 'MATCHING':
      if (options.length < 2) critical.push('Add at least two matching pairs.');
      options.forEach((o, idx) => {
        const pair = splitMatchingPair(o.content);
        if (!pair.left || !pair.right) {
          critical.push(`Pair #${idx + 1} needs both a left and a right value.`);
        }
      });
      break;
    default:
      break;
  }

  // Option length imbalance (weak-distractor hint) for choice questions.
  if (isChoice(kind) && options.length >= 2) {
    const lengths = options.map((o) => plainText(o.content).length).filter((n) => n > 0);
    if (lengths.length >= 2) {
      const max = Math.max(...lengths);
      const min = Math.min(...lengths);
      if (min > 0 && max >= min * 4 && max - min > 40) {
        warnings.push('Option lengths are very uneven — a distractor may be too obvious.');
      }
    }
  }

  // ── Difficulty ──
  const diff = Number(q.difficulty);
  if (!Number.isInteger(diff) || diff < 1 || diff > 5) {
    critical.push('Difficulty must be a whole number from 1 to 5.');
  }

  // ── Quality ──
  if (!q.explanation || !plainText(q.explanation)) {
    warnings.push('No explanation provided.');
  }

  // ── Confidence ──
  let confidence = Math.max(0, Math.min(1, baseConfidence));
  confidence -= warnings.length * 0.08;
  if (critical.length > 0) confidence = Math.min(confidence, 0.3);
  confidence = Math.max(0, Math.round(confidence * 100) / 100);

  return { critical, warnings, confidence };
}

/** True when the question has no critical errors and may be committed. */
export function isCommittable(result: ValidationResult): boolean {
  return result.critical.length === 0;
}
