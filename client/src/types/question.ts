export interface QuestionOption {
  id: number;
  questionId?: number;
  label: string;
  content: string;
  isCorrect: boolean;
}

export interface QuestionTag {
  id: number;
  questionId?: number;
  tagName: string;
}

export type QuestionKind =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'MATCHING';

export type ReviewStatus =
  | 'needs_review'
  | 'needs_revision'
  | 'approved'
  | 'good'
  | 'rejected';

export interface QuestionReviewSummary {
  status: string;
  qualityFlag?: string | null;
  reviewedAt?: string | null;
}

export interface Question {
  id: number;
  subjectId: number;
  chapterId: number | null;
  content: string;
  questionType: QuestionKind;
  difficulty: 1 | 2 | 3 | 4 | 5;
  explanation: string | null;
  createdBy: number;
  createdAt: string;
  options: QuestionOption[];
  tags: QuestionTag[];
  subject?: { id: number; name: string; code: string };
  chapter?: { id: number; name: string; gradeLevel?: number } | null;
  creator?: { id: number; fullName: string };
  review?: QuestionReviewSummary | null;
}

export interface QuestionVersion {
  id: number;
  questionId: number;
  versionNo: number;
  content: string;
  questionType: QuestionKind;
  difficulty: number;
  explanation: string | null;
  optionsJson: Array<{ label: string; content: string; isCorrect: boolean }>;
  changedBy: number | null;
  changeReason: string | null;
  createdAt: string;
  changer?: { id: number; fullName: string | null } | null;
}

export interface QuestionFilter {
  subjectId?: number | string;
  gradeLevel?: number | string;
  chapterId?: number | string;
  difficulty?: number | string;
  search?: string;
  questionType?: QuestionKind;
  reviewStatus?: ReviewStatus | '';
  tag?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateQuestionPayload {
  subjectId: number;
  chapterId?: number;
  content: string;
  questionType: QuestionKind;
  difficulty: number;
  explanation?: string;
  options: Array<{
    label: string;
    content: string;
    isCorrect: boolean;
  }>;
  tags?: string[];
}

export interface UpdateQuestionPayload extends Partial<CreateQuestionPayload> {}

export interface ImportQuestionResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}

// ── AI / Document extraction ──────────────────────

export interface ExtractedOption {
  label: string;
  content: string;
  isCorrect: boolean;
  /** Inline image URL for this option (ZIP image import). */
  imageUrl?: string | null;
}

export interface ExtractedQuestion {
  content: string;
  questionType: QuestionKind;
  difficulty: number;
  explanation: string | null;
  options: ExtractedOption[];
  warnings: string[];
  errors?: string[];
  sourceLine?: number | null;
  sourceText?: string;
  /** Inline image URLs (ZIP image import). */
  questionImageUrl?: string | null;
  explanationImageUrl?: string | null;
}

export interface ExtractFromDocumentResult {
  rawTextPreview: string;
  source: 'openai' | 'regex';
  questions: ExtractedQuestion[];
  warnings: string[];
  templateRules?: string[];
}

// ── ZIP image import ──────────────────────────────

export interface ZipImportResult {
  source: 'zip';
  questions: ExtractedQuestion[];
  warnings: string[];
  total: number;
  valid: number;
  invalid: number;
}

export interface BulkCreateResult {
  imported: number;
  failed: number;
  total: number;
  errors?: Array<{ index: number; message: string }> | null;
}

// ── Unified import pipeline (ImportJob / preview / commit) ────────────────────

export type ImportJobStatus =
  | 'PENDING'
  | 'PARSING'
  | 'READY'
  | 'COMMITTING'
  | 'COMPLETED'
  | 'FAILED';

export type ImportPreviewItemStatus =
  | 'PENDING'
  | 'VALID'
  | 'INVALID'
  | 'SKIPPED'
  | 'COMMITTED';

export interface ImportJob {
  id: number;
  fileName: string;
  fileType: string;
  sourceFormat: string;
  status: ImportJobStatus;
  progress: number;
  totalItems: number;
  validItems: number;
  invalidItems: number;
  warningCount: number;
  importedCount: number;
  subjectId: number | null;
  chapterId: number | null;
  parserSource: string | null;
  errorMessage: string | null;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ImportValidationResult {
  critical: string[];
  warnings: string[];
  confidence: number;
}

export interface NormalizedImportOption {
  label: string;
  content: string;
  isCorrect: boolean;
  imageUrl?: string | null;
}

export interface NormalizedImportQuestion {
  content: string;
  questionType: QuestionKind;
  difficulty: number;
  explanation: string | null;
  options: NormalizedImportOption[];
  questionImageUrl?: string | null;
  explanationImageUrl?: string | null;
}

export interface DuplicateMatch {
  questionId: number;
  similarity: number;
  method: 'exact' | 'near';
  contentPreview: string;
  questionType: string;
}

export interface ImportItemDuplicates {
  matches: DuplicateMatch[];
}

export interface ImportPreviewItem {
  id: number;
  importJobId: number;
  orderIndex: number;
  rawText: string | null;
  normalizedJson: NormalizedImportQuestion;
  validationJson: ImportValidationResult;
  duplicateJson: ImportItemDuplicates | null;
  confidence: number;
  sourcePage: number | null;
  sourceLine: number | null;
  status: ImportPreviewItemStatus;
  questionId: number | null;
}

export interface DuplicatePair {
  a: { id: number; contentPreview: string; questionType: string };
  b: { id: number; contentPreview: string; questionType: string };
  similarity: number;
}

export interface ImportPreview {
  job: ImportJob;
  items: ImportPreviewItem[];
}

export interface ImportCommitResult {
  imported: number;
  failed: number;
  skipped: number;
  total: number;
  errors?: Array<{ index: number; message: string }> | null;
}

// ── AI enrichment suggestions (Phase 6) ───────────────────────────────────────

export interface AiWeakDistractor {
  label: string;
  reason: string;
}

export interface AiSuggestion {
  available: boolean;
  difficulty?: number;
  tags?: string[];
  explanation?: string;
  weakDistractors?: AiWeakDistractor[];
  notes?: string;
}

export interface CurriculumSubject {
  id: number;
  name: string;
  code: string;
  description?: string;
  status?: number;
}

export interface CurriculumChapter {
  id: number;
  subjectId: number;
  name: string;
  gradeLevel: number;
  orderIndex: number;
}

