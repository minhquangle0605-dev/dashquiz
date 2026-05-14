import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type { PaginatedResponse } from '@/types/api';
import type {
  ClassItem,
  ClassStudent,
  ClassActivity,
  ClassCourseOverview,
  ClassResource,
  ClassSection,
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
  const students = data.data ?? data;
  if (!Array.isArray(students)) return [];

  return students.map((item) => {
    if (item.student && item.studentId) return item as ClassStudent;

    return {
      classId,
      studentId: item.id,
      enrolledAt: item.enrolledAt,
      student: {
        id: item.id,
        username: item.username,
        fullName: item.fullName,
        phone: item.phone ?? null,
        avatar: item.avatar ?? null,
      },
    } satisfies ClassStudent;
  });
}

export async function addStudents(
  classId: number,
  studentIds: number[],
): Promise<void> {
  await api.post(API_ENDPOINTS.CLASSES.STUDENTS(classId), {
    userIds: studentIds,
    studentIds,
  });
}

export interface AvailableStudent {
  id: number;
  username: string;
  fullName: string | null;
  avatar: string | null;
  status: string;
  studentCode?: string | null;
  homeroomClassName?: string | null;
  gradeLevel?: number | null;
}

export interface AvailableStudentsParams {
  search?: string;
  gradeLevel?: number;
  homeroomClassName?: string;
  limit?: number;
}

export async function listAvailableStudents(
  classId: number,
  params: AvailableStudentsParams = {},
): Promise<AvailableStudent[]> {
  const { data } = await api.get(API_ENDPOINTS.CLASSES.AVAILABLE_STUDENTS(classId), { params });
  return data.data ?? data;
}

export interface ClassNameOption {
  name: string;
  gradeLevel: number;
}

export async function listClassNames(gradeLevel?: number): Promise<ClassNameOption[]> {
  const { data } = await api.get(API_ENDPOINTS.CLASSES.CLASS_NAMES, {
    params: gradeLevel ? { gradeLevel } : {},
  });
  return data.data ?? data;
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

export async function getClassCourse(classId: number): Promise<ClassCourseOverview> {
  const { data } = await api.get(API_ENDPOINTS.CLASSES.COURSE(classId));
  return data.data ?? data;
}

export async function createSection(
  classId: number,
  payload: Partial<ClassSection> & { title: string },
): Promise<ClassSection> {
  const { data } = await api.post(API_ENDPOINTS.CLASSES.SECTIONS(classId), payload);
  return data.data ?? data;
}

export async function createResource(
  classId: number,
  payload: Partial<ClassResource> & { title: string; type: ClassResource['type'] },
): Promise<ClassResource> {
  const { data } = await api.post(API_ENDPOINTS.CLASSES.RESOURCES(classId), payload);
  return data.data ?? data;
}

export async function uploadResourceFile(
  classId: number,
  payload: {
    file: File;
    title?: string;
    description?: string;
    sectionId?: number | null;
    isPublished?: boolean;
  },
): Promise<ClassResource> {
  const formData = new FormData();
  formData.append('file', payload.file);
  if (payload.title) formData.append('title', payload.title);
  if (payload.description) formData.append('description', payload.description);
  if (payload.sectionId) formData.append('sectionId', String(payload.sectionId));
  if (payload.isPublished !== undefined) formData.append('isPublished', String(payload.isPublished));
  const { data } = await api.post(API_ENDPOINTS.CLASSES.RESOURCE_UPLOAD(classId), formData);
  return data.data ?? data;
}

export async function getResourceDownloadUrl(resourceId: number): Promise<string> {
  const { data } = await api.get(API_ENDPOINTS.CLASSES.RESOURCE_DOWNLOAD(resourceId));
  return (data.data ?? data).url;
}

export async function createActivity(
  classId: number,
  payload: Partial<ClassActivity> & { title: string; type: ClassActivity['type'] },
): Promise<ClassActivity> {
  const { data } = await api.post(API_ENDPOINTS.CLASSES.ACTIVITIES(classId), payload);
  return data.data ?? data;
}

export async function submitActivity(
  activityId: number,
  payload: { content?: string; fileUrl?: string; fileName?: string },
): Promise<void> {
  await api.post(API_ENDPOINTS.CLASSES.ACTIVITY_SUBMISSIONS(activityId), payload);
}

export async function markCompletion(
  classId: number,
  payload: { resourceId?: number; activityId?: number },
): Promise<void> {
  await api.post(API_ENDPOINTS.CLASSES.COMPLETIONS(classId), payload);
}
