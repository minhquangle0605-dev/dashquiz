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

export interface Question {
  id: number;
  subjectId: number;
  chapterId: number | null;
  topicId: number | null;
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
  topic?: { id: number; name: string } | null;
  creator?: { id: number; fullName: string };
}

export interface QuestionFilter {
  subjectId?: number | string;
  gradeLevel?: number | string;
  chapterId?: number | string;
  topicId?: number | string;
  difficulty?: number | string;
  search?: string;
  questionType?: QuestionKind;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateQuestionPayload {
  subjectId: number;
  chapterId?: number;
  topicId?: number;
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

export interface CurriculumTopic {
  id: number;
  chapterId: number;
  name: string;
  description?: string;
}
