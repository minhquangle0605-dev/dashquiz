import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
  ChangeRolePayload,
  Subject,
  CreateSubjectPayload,
  AcademicYear,
  CreateAcademicYearPayload,
  Semester,
  CreateSemesterPayload,
  SystemConfig,
  UpdateConfigPayload,
  MonitoringData,
  ActivityLog,
  Backup,
} from '@/types/admin';
import type { PaginatedResponse, PaginationParams } from '@/types/api';

// ── User Management ──────────────────────────────────

export interface ListUsersParams extends PaginationParams {
  search?: string;
  role?: string;
  status?: string;
}

export async function listUsers(
  params: ListUsersParams = {}
): Promise<PaginatedResponse<AdminUser>> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.USERS.BASE, { params });
  return data.data ?? data;
}

export async function createUser(payload: CreateUserPayload): Promise<AdminUser> {
  const { data } = await api.post(API_ENDPOINTS.ADMIN.USERS.BASE, payload);
  return data.data ?? data;
}

export async function updateUser(
  id: number,
  payload: UpdateUserPayload
): Promise<AdminUser> {
  const { data } = await api.put(API_ENDPOINTS.ADMIN.USERS.BY_ID(id), payload);
  return data.data ?? data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(API_ENDPOINTS.ADMIN.USERS.BY_ID(id));
}

export async function changeUserRole(
  id: number,
  payload: ChangeRolePayload
): Promise<AdminUser> {
  const { data } = await api.put(API_ENDPOINTS.ADMIN.USERS.ROLE(id), payload);
  return data.data ?? data;
}

export async function importUsers(file: File): Promise<{ imported: number; errors: string[] }> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(API_ENDPOINTS.ADMIN.USERS.IMPORT, formData);
  return data.data ?? data;
}

export function getImportTemplateUrl(): string {
  return API_ENDPOINTS.ADMIN.USERS.IMPORT_TEMPLATE;
}

// ── Academic Management ──────────────────────────────

export async function listSubjects(): Promise<Subject[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.ACADEMIC.SUBJECTS);
  return data.data ?? data;
}

export async function createSubject(payload: CreateSubjectPayload): Promise<Subject> {
  const { data } = await api.post(API_ENDPOINTS.ADMIN.ACADEMIC.SUBJECTS, payload);
  return data.data ?? data;
}

export async function updateSubject(
  id: number,
  payload: Partial<CreateSubjectPayload>
): Promise<Subject> {
  const { data } = await api.put(
    API_ENDPOINTS.ADMIN.ACADEMIC.SUBJECT_BY_ID(id),
    payload
  );
  return data.data ?? data;
}

export async function listAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.ACADEMIC.ACADEMIC_YEARS);
  return data.data ?? data;
}

export async function createAcademicYear(
  payload: CreateAcademicYearPayload
): Promise<AcademicYear> {
  const { data } = await api.post(
    API_ENDPOINTS.ADMIN.ACADEMIC.ACADEMIC_YEARS,
    payload
  );
  return data.data ?? data;
}

export async function updateAcademicYear(
  id: number,
  payload: Partial<CreateAcademicYearPayload>
): Promise<AcademicYear> {
  const { data } = await api.put(
    API_ENDPOINTS.ADMIN.ACADEMIC.ACADEMIC_YEAR_BY_ID(id),
    payload
  );
  return data.data ?? data;
}

export async function listSemesters(
  academicYearId?: number
): Promise<Semester[]> {
  const params = academicYearId ? { academicYearId } : {};
  const { data } = await api.get(API_ENDPOINTS.ADMIN.ACADEMIC.SEMESTERS, {
    params,
  });
  return data.data ?? data;
}

export async function createSemester(
  payload: CreateSemesterPayload
): Promise<Semester> {
  const { data } = await api.post(
    API_ENDPOINTS.ADMIN.ACADEMIC.SEMESTERS,
    payload
  );
  return data.data ?? data;
}

export async function updateSemester(
  id: number,
  payload: Partial<CreateSemesterPayload>
): Promise<Semester> {
  const { data } = await api.put(
    API_ENDPOINTS.ADMIN.ACADEMIC.SEMESTER_BY_ID(id),
    payload
  );
  return data.data ?? data;
}

// ── System Management ──────────────────────────────

export async function getSystemConfigs(): Promise<SystemConfig[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.SYSTEM.CONFIGS);
  return data.data ?? data;
}

export async function updateSystemConfigs(
  payload: UpdateConfigPayload
): Promise<SystemConfig[]> {
  const { data } = await api.put(API_ENDPOINTS.ADMIN.SYSTEM.CONFIGS, payload);
  return data.data ?? data;
}

export async function getMonitoring(): Promise<MonitoringData> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.SYSTEM.MONITORING);
  return data.data ?? data;
}

export interface ListLogsParams extends PaginationParams {
  action?: string;
  userId?: number;
  startDate?: string;
  endDate?: string;
}

export async function listActivityLogs(
  params: ListLogsParams = {}
): Promise<PaginatedResponse<ActivityLog>> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.SYSTEM.ACTIVITY_LOGS, {
    params,
  });
  return data.data ?? data;
}

export async function listBackups(): Promise<Backup[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.SYSTEM.BACKUPS);
  return data.data ?? data;
}

export async function createBackup(): Promise<Backup> {
  const { data } = await api.post(API_ENDPOINTS.ADMIN.SYSTEM.BACKUPS);
  return data.data ?? data;
}

export async function restoreBackup(id: number): Promise<void> {
  await api.post(API_ENDPOINTS.ADMIN.SYSTEM.BACKUP_RESTORE(id));
}
