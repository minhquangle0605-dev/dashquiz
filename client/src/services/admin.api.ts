import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
  ChangeRolePayload,
  RoleOption,
  Subject,
  UpdateSubjectPayload,
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
  const { page, pageSize, sortBy, sortOrder, ...rest } = params;
  const query: Record<string, unknown> = { ...rest };
  if (page !== undefined) query.page = page;
  if (pageSize !== undefined) query.limit = pageSize;
  if (sortBy !== undefined) query.sort = sortBy;
  if (sortOrder !== undefined) query.order = sortOrder;

  const { data } = await api.get(API_ENDPOINTS.ADMIN.USERS.BASE, { params: query });
  const items: AdminUser[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const pagination = data?.pagination ?? {};
  return {
    items,
    total: pagination.total ?? items.length,
    page: pagination.page ?? page ?? 1,
    pageSize: pagination.limit ?? pageSize ?? items.length,
    totalPages: pagination.totalPages ?? 1,
    hasNextPage: pagination.hasNext ?? false,
    hasPreviousPage: pagination.hasPrev ?? false,
  };
}

export async function listAdminRoles(): Promise<RoleOption[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.USERS.ROLES);
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

export interface ImportUserError {
  row: number;
  field: string;
  message: string;
}

export interface ImportUserCredential {
  username: string;
  password: string;
  fullName: string | null;
  role: string;
  accountCode: string | null;
  passwordGenerated: boolean;
}

export interface ImportUsersResult {
  imported: number;
  created?: number;
  totalRows?: number;
  studentsCreated?: number;
  teachersCreated?: number;
  parentsCreated?: number;
  parentsReused?: number;
  errorCount?: number;
  errors: ImportUserError[];
  warnings: string[];
  credentials: ImportUserCredential[];
}

export interface ResetPasswordResult {
  username: string;
  password: string;
  passwordGenerated: boolean;
  mustChangePassword: boolean;
}

export async function resetUserPassword(
  id: number,
  password?: string,
): Promise<ResetPasswordResult> {
  const { data } = await api.post(API_ENDPOINTS.ADMIN.USERS.RESET_PASSWORD(id), password ? { password } : {});
  const payload = (data?.data ?? data ?? {}) as Partial<ResetPasswordResult>;
  return {
    username: String(payload.username ?? ''),
    password: String(payload.password ?? ''),
    passwordGenerated: Boolean(payload.passwordGenerated),
    mustChangePassword: Boolean(payload.mustChangePassword ?? true),
  };
}

export async function importUsers(file: File): Promise<ImportUsersResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(API_ENDPOINTS.ADMIN.USERS.IMPORT, formData);
  const payload = data?.data ?? data ?? {};
  const rawErrors = Array.isArray(payload.errors) ? payload.errors : [];
  const errors: ImportUserError[] = rawErrors.map((e: unknown) => {
    if (typeof e === 'string') return { row: 0, field: '', message: e };
    const obj = (e ?? {}) as { row?: number; field?: string; message?: string };
    return {
      row: typeof obj.row === 'number' ? obj.row : 0,
      field: typeof obj.field === 'string' ? obj.field : '',
      message: typeof obj.message === 'string' ? obj.message : String(e),
    };
  });
  const rawCredentials = Array.isArray(payload.credentials) ? payload.credentials : [];
  const credentials: ImportUserCredential[] = rawCredentials.map((c: unknown) => {
    const obj = (c ?? {}) as Partial<ImportUserCredential>;
    return {
      username: String(obj.username ?? ''),
      password: String(obj.password ?? ''),
      fullName: obj.fullName ?? null,
      role: String(obj.role ?? ''),
      accountCode: obj.accountCode ?? null,
      passwordGenerated: Boolean(obj.passwordGenerated),
    };
  });
  const warnings: string[] = Array.isArray(payload.warnings)
    ? payload.warnings.map((w: unknown) => String(w))
    : [];
  return {
    imported: payload.imported ?? payload.created ?? 0,
    created: payload.created,
    totalRows: payload.totalRows,
    studentsCreated: payload.studentsCreated,
    teachersCreated: payload.teachersCreated,
    parentsCreated: payload.parentsCreated,
    parentsReused: payload.parentsReused,
    errorCount: payload.errorCount,
    errors,
    warnings,
    credentials,
  };
}

export function getImportTemplateUrl(): string {
  return API_ENDPOINTS.ADMIN.USERS.IMPORT_TEMPLATE;
}

// ── Academic Management ──────────────────────────────

export async function listSubjects(): Promise<Subject[]> {
  const { data } = await api.get(API_ENDPOINTS.ADMIN.ACADEMIC.SUBJECTS);
  return data.data ?? data;
}

export async function updateSubject(
  id: number,
  payload: UpdateSubjectPayload
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
