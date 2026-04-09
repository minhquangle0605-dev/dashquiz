import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type { PaginatedResponse } from '@/types/api';
import type {
  Question,
  QuestionFilter,
  CreateQuestionPayload,
  UpdateQuestionPayload,
  ImportQuestionResult,
  CurriculumSubject,
  CurriculumChapter,
  CurriculumTopic,
} from '@/types/question';

// ── Questions CRUD ─────────────────────────────────

export async function listQuestions(
  params: QuestionFilter = {},
): Promise<PaginatedResponse<Question>> {
  const { data } = await api.get(API_ENDPOINTS.QUESTIONS.BASE, { params });
  return data.data ?? data;
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
  chapterId?: number,
  topicId?: number,
): Promise<ImportQuestionResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('subjectId', String(subjectId));
  if (chapterId) formData.append('chapterId', String(chapterId));
  if (topicId) formData.append('topicId', String(topicId));
  const { data } = await api.post(API_ENDPOINTS.QUESTIONS.IMPORT, formData);
  return data.data ?? data;
}

export function getImportTemplateUrl(): string {
  return API_ENDPOINTS.QUESTIONS.IMPORT_TEMPLATE;
}

// ── Curriculum (Subject → Chapter → Topic) ────────

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
  return data.data ?? data;
}

export async function getTopicsByChapter(
  chapterId: number,
): Promise<CurriculumTopic[]> {
  const { data } = await api.get(
    API_ENDPOINTS.CURRICULUM.TOPICS_BY_CHAPTER(chapterId),
  );
  return data.data ?? data;
}
