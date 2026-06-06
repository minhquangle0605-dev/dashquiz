import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  ImportJob,
  ImportPreview,
  ImportPreviewItem,
  ImportCommitResult,
  NormalizedImportQuestion,
  QuestionKind,
  DuplicatePair,
} from '@/types/question';

interface ServerResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

/** Upload a file and create an import job; parsing runs in the background. */
export async function createImportJob(
  file: File,
  meta: { subjectId?: number; chapterId?: number; topicId?: number },
  onUploadProgress?: (progress: number) => void,
): Promise<ImportJob> {
  const formData = new FormData();
  formData.append('file', file);
  if (meta.subjectId) formData.append('subjectId', String(meta.subjectId));
  if (meta.chapterId) formData.append('chapterId', String(meta.chapterId));
  if (meta.topicId) formData.append('topicId', String(meta.topicId));
  const { data } = await api.post<ServerResponse<ImportJob>>(
    API_ENDPOINTS.QUESTIONS.IMPORT_JOBS,
    formData,
    {
      onUploadProgress: (event) => {
        if (!event.total || !onUploadProgress) return;
        onUploadProgress(Math.round((event.loaded * 100) / event.total));
      },
    },
  );
  return data.data;
}

export async function listImportJobs(): Promise<ImportJob[]> {
  const { data } = await api.get<ServerResponse<ImportJob[]>>(API_ENDPOINTS.QUESTIONS.IMPORT_JOBS);
  return data.data ?? [];
}

export async function getImportJob(id: number): Promise<ImportJob> {
  const { data } = await api.get<ServerResponse<ImportJob>>(API_ENDPOINTS.QUESTIONS.IMPORT_JOB(id));
  return data.data;
}

export async function getImportPreview(id: number): Promise<ImportPreview> {
  const { data } = await api.get<ServerResponse<ImportPreview>>(
    API_ENDPOINTS.QUESTIONS.IMPORT_JOB_PREVIEW(id),
  );
  return data.data;
}

export async function updateImportPreviewItem(
  itemId: number,
  question: NormalizedImportQuestion,
): Promise<ImportPreviewItem> {
  const { data } = await api.put<ServerResponse<ImportPreviewItem>>(
    API_ENDPOINTS.QUESTIONS.IMPORT_PREVIEW_ITEM(itemId),
    { question },
  );
  return data.data;
}

export type BulkFixAction =
  | { type: 'set-difficulty'; difficulty: number; itemIds?: number[] }
  | { type: 'set-type'; questionType: QuestionKind; itemIds?: number[] }
  | { type: 'set-taxonomy'; subjectId?: number | null; chapterId?: number | null; topicId?: number | null }
  | { type: 'skip-invalid' }
  | { type: 'skip'; itemIds: number[] };

export async function bulkFixImportJob(id: number, action: BulkFixAction): Promise<ImportPreview> {
  const { data } = await api.post<ServerResponse<ImportPreview>>(
    API_ENDPOINTS.QUESTIONS.IMPORT_JOB_BULK_FIX(id),
    action,
  );
  return data.data;
}

export async function revalidateImportJob(id: number): Promise<ImportPreview> {
  const { data } = await api.post<ServerResponse<ImportPreview>>(
    API_ENDPOINTS.QUESTIONS.IMPORT_JOB_VALIDATE(id),
    {},
  );
  return data.data;
}

export async function commitImportJob(
  id: number,
  itemIds?: number[],
): Promise<ImportCommitResult> {
  const { data } = await api.post<ServerResponse<ImportCommitResult>>(
    API_ENDPOINTS.QUESTIONS.IMPORT_JOB_COMMIT(id),
    itemIds ? { itemIds } : {},
  );
  return data.data;
}

export async function retryImportJob(id: number): Promise<ImportJob> {
  const { data } = await api.post<ServerResponse<ImportJob>>(
    API_ENDPOINTS.QUESTIONS.IMPORT_JOB_RETRY(id),
    {},
  );
  return data.data;
}

export async function deleteImportJob(id: number): Promise<void> {
  await api.delete(API_ENDPOINTS.QUESTIONS.IMPORT_JOB(id));
}

// ── Duplicate review (bank-level) ───────────────────────────────────────────

export async function listDuplicateClusters(subjectId?: number): Promise<DuplicatePair[]> {
  const { data } = await api.get<ServerResponse<DuplicatePair[]>>(
    API_ENDPOINTS.QUESTIONS.DUPLICATES,
    { params: subjectId ? { subjectId } : {} },
  );
  return data.data ?? [];
}

export async function resolveDuplicate(payload: {
  questionId: number;
  duplicateQuestionId: number;
  action: 'acceptable' | 'dismiss' | 'delete';
}): Promise<void> {
  await api.post(API_ENDPOINTS.QUESTIONS.DUPLICATES_RESOLVE, payload);
}
