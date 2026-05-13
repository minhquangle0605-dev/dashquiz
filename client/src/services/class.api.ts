import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type { PaginatedResponse } from '@/types/api';
import type {
  ClassItem,
  ClassStudent,
  CreateClassPayload,
  UpdateClassPayload,
  ImportStudentsResult,
} from '@/types/exam';

export interface ClassListParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export async function listClasses(
  params: ClassListParams = {},
): Promise<PaginatedResponse<ClassItem>> {
  const { data } = await api.get(API_ENDPOINTS.CLASSES.BASE, { params });
  return data.data ?? data;
}

/**
 * Fetch the list of classes the authenticated student is enrolled in.
 * Used by the Student "My Classes" page.
 */
export async function listMyClasses(): Promise<ClassItem[]> {
  const { data } = await api.get(API_ENDPOINTS.CLASSES.MY);
  return data.data ?? data;
}

export async function createClass(
  payload: CreateClassPayload,
): Promise<ClassItem> {
  const { data } = await api.post(API_ENDPOINTS.CLASSES.BASE, payload);
  return data.data ?? data;
}

export async function updateClass(
  id: number,
  payload: UpdateClassPayload,
): Promise<ClassItem> {
  const { data } = await api.put(API_ENDPOINTS.CLASSES.BY_ID(id), payload);
  return data.data ?? data;
}

export async function listStudents(classId: number): Promise<ClassStudent[]> {
  const { data } = await api.get(API_ENDPOINTS.CLASSES.STUDENTS(classId));
  return data.data ?? data;
}

export async function addStudents(
  classId: number,
  studentIds: number[],
): Promise<void> {
  await api.post(API_ENDPOINTS.CLASSES.STUDENTS(classId), { studentIds });
}

export async function removeStudent(
  classId: number,
  studentId: number,
): Promise<void> {
  await api.delete(API_ENDPOINTS.CLASSES.REMOVE_STUDENT(classId, studentId));
}

export async function importStudents(
  classId: number,
  file: File,
): Promise<ImportStudentsResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(
    API_ENDPOINTS.CLASSES.IMPORT_STUDENTS(classId),
    formData,
  );
  return data.data ?? data;
}

export function getImportTemplateUrl(): string {
  return API_ENDPOINTS.CLASSES.IMPORT_TEMPLATE;
}
