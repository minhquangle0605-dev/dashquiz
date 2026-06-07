import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type { PaginatedResponse } from '@/types/api';
import type {
  Question,
  QuestionFilter,
  QuestionVersion,
  ReviewStatus,
  AiSuggestion,
  CreateQuestionPayload,
  UpdateQuestionPayload,
  ImportQuestionResult,
  ExtractFromDocumentResult,
  ExtractedQuestion,
  ZipImportResult,
  BulkCreateResult,
  CurriculumSubject,
  CurriculumChapter,
} from '@/types/question';

// ── Questions CRUD ─────────────────────────────────

export async function listQuestions(
  params: QuestionFilter = {},
): Promise<PaginatedResponse<Question>> {
  const requestParams = {
    ...params,
    limit: params.pageSize,
    keyword: params.search,
  };
  delete (requestParams as Record<string, unknown>).pageSize;
  delete (requestParams as Record<string, unknown>).search;

  const { data } = await api.get(API_ENDPOINTS.QUESTIONS.BASE, { params: requestParams });
  
  if (data.pagination) {
    return {
      items: data.data || [],
      total: data.pagination.total || 0,
      page: data.pagination.page || 1,
      pageSize: data.pagination.limit || 12,
      totalPages: data.pagination.totalPages || 1,
      hasNextPage: data.pagination.hasNext || false,
      hasPreviousPage: data.pagination.hasPrev || false,
    };
  }
  
  const resultData = data.data ?? data;
  const items = Array.isArray(resultData) ? resultData : [];
  
  return {
    items,
    total: items.length,
    page: 1,
    pageSize: params.pageSize || 12,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

export async function getQuestionById(id: number): Promise<Question> {
  const { data } = await api.get(API_ENDPOINTS.QUESTIONS.BY_ID(id));
  return data.data ?? data;
}

export async function createQuestion(
  payload: CreateQuestionPayload,
): Promise<Question> {
  const { data } = await api.post(API_ENDPOINTS.QUESTIONS.BASE, payload);
  return data.data ?? data;
}

export async function updateQuestion(
  id: number,
  payload: UpdateQuestionPayload,
): Promise<Question> {
  const { data } = await api.put(API_ENDPOINTS.QUESTIONS.BY_ID(id), payload);
  return data.data ?? data;
}

export async function deleteQuestion(id: number): Promise<void> {
  await api.delete(API_ENDPOINTS.QUESTIONS.BY_ID(id));
}

export async function bulkUpdateQuestions(
  ids: number[],
  changes: { difficulty?: number; reviewStatus?: ReviewStatus },
): Promise<void> {
  await api.post(API_ENDPOINTS.QUESTIONS.BULK_UPDATE, { ids, ...changes });
}

export async function aiSuggestQuestion(input: {
  content: string;
  questionType: string;
  options: Array<{ label: string; content: string; isCorrect: boolean }>;
  subjectName?: string;
  chapterName?: string;
  currentDifficulty?: number;
}): Promise<AiSuggestion> {
  const { data } = await api.post(API_ENDPOINTS.QUESTIONS.AI_SUGGEST, input);
  return data.data;
}

export async function getQuestionVersions(id: number): Promise<QuestionVersion[]> {
  const { data } = await api.get(API_ENDPOINTS.QUESTIONS.VERSIONS(id));
  return data.data ?? [];
}

export async function restoreQuestionVersion(id: number, versionId: number): Promise<void> {
  await api.post(API_ENDPOINTS.QUESTIONS.VERSION_RESTORE(id, versionId), {});
}

export async function bulkDeleteQuestions(ids: number[]): Promise<void> {
  await api.post(API_ENDPOINTS.QUESTIONS.BULK_DELETE, { ids });
}

export async function uploadQuestionImage(file: File): Promise<{ url: string; objectName: string }> {
  const formData = new FormData();
  formData.append('image', file);
  const { data } = await api.post(API_ENDPOINTS.QUESTIONS.IMAGE_UPLOAD, formData);
  return data.data ?? data;
}

// ── Tags ───────────────────────────────────────────

export async function addTags(
  questionId: number,
  tags: string[],
): Promise<void> {
  await api.post(API_ENDPOINTS.QUESTIONS.TAGS(questionId), { tags });
}

export async function removeTag(
  questionId: number,
  tagId: number,
): Promise<void> {
  await api.delete(API_ENDPOINTS.QUESTIONS.TAG_BY_ID(questionId, tagId));
}

// ── Import / Export ────────────────────────────────

export async function importQuestions(
  file: File,
  subjectId: number,
  chapterId: number,
): Promise<ImportQuestionResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('subjectId', String(subjectId));
  if (chapterId) formData.append('chapterId', String(chapterId));
  const { data } = await api.post(API_ENDPOINTS.QUESTIONS.IMPORT, formData);
  return data.data ?? data;
}

export function getImportTemplateUrl(): string {
  return API_ENDPOINTS.QUESTIONS.IMPORT_TEMPLATE;
}

export function getDocumentImportTemplateUrl(): string {
  return API_ENDPOINTS.QUESTIONS.DOCUMENT_IMPORT_TEMPLATE;
}

export async function downloadDocumentImportTemplate(): Promise<Blob> {
  const { data } = await api.get(API_ENDPOINTS.QUESTIONS.DOCUMENT_IMPORT_TEMPLATE, {
    responseType: 'blob',
  });
  return data;
}

// ── ZIP image import ──────────────────────────────

export async function importQuestionsFromZip(
  file: File,
  onUploadProgress?: (progress: number) => void,
): Promise<ZipImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(API_ENDPOINTS.QUESTIONS.IMPORT_ZIP, formData, {
    onUploadProgress: (event) => {
      if (!event.total || !onUploadProgress) return;
      onUploadProgress(Math.round((event.loaded * 100) / event.total));
    },
  });
  return data.data ?? data;
}

export async function downloadZipImportTemplate(): Promise<Blob> {
  const { data } = await api.get(API_ENDPOINTS.QUESTIONS.ZIP_IMPORT_TEMPLATE, {
    responseType: 'blob',
  });
  return data;
}

export async function exportQuestionsGift(ids: number[]): Promise<Blob> {
  const { data } = await api.post(
    API_ENDPOINTS.QUESTIONS.EXPORT_GIFT,
    { ids },
    { responseType: 'blob' },
  );
  return data;
}

// ── AI / Document extraction ──────────────────────

export async function extractQuestionsFromDocument(
  file: File,
  onUploadProgress?: (progress: number) => void,
): Promise<ExtractFromDocumentResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(
    API_ENDPOINTS.QUESTIONS.EXTRACT_FROM_DOCUMENT,
    formData,
    {
      onUploadProgress: (event) => {
        if (!event.total || !onUploadProgress) return;
        onUploadProgress(Math.round((event.loaded * 100) / event.total));
      },
    },
  );
  return data.data ?? data;
}

export async function bulkCreateQuestions(
  questions: ExtractedQuestion[],
  subjectId: number,
  chapterId: number,
): Promise<BulkCreateResult> {
  const { data } = await api.post(API_ENDPOINTS.QUESTIONS.BULK_CREATE, {
    subjectId,
    chapterId,
    questions,
  });
  return data.data ?? data;
}

// ── Curriculum (Subject → Chapter) ────────

export async function listSubjects(): Promise<CurriculumSubject[]> {
  const { data } = await api.get(API_ENDPOINTS.CURRICULUM.SUBJECTS);
  return data.data ?? data;
}

export async function getChaptersBySubject(
  subjectId: number,
): Promise<CurriculumChapter[]> {
  const { data } = await api.get(
    API_ENDPOINTS.CURRICULUM.CHAPTERS_BY_SUBJECT(subjectId),
  );
  const result = data.data ?? data;
  return Array.isArray(result) ? result : (result?.chapters ?? result ?? []);
}
