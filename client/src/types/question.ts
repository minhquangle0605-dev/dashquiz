export interface QuestionOption {
  id: string;
  label: string;
  text: string;
  isCorrect?: boolean;
}

export interface QuestionTag {
  id: string;
  name: string;
  slug?: string;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface Question {
  id: string;
  subjectId: string;
  chapterId?: string;
  topicId?: string;
  type: QuestionType;
  prompt: string;
  /** Difficulty scale 1 (easiest) — 5 (hardest). */
  difficulty: 1 | 2 | 3 | 4 | 5;
  points: number;
  options?: QuestionOption[];
  tags: QuestionTag[];
  explanation?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionFilter {
  subjectId?: string;
  chapterId?: string;
  topicId?: string;
  difficulty?: 1 | 2 | 3 | 4 | 5;
  tagIds?: string[];
  search?: string;
  type?: QuestionType;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ImportQuestionResult {
  totalRows: number;
  imported: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
}
