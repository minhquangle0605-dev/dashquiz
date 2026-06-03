import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  ClassTimetable,
  CheckConflictsPayload,
  ConflictCheckResult,
  CreateSlotPayload,
  CreateTimetableClassPayload,
  ImportTimetableResult,
  TimetableSlot,
  UpdateSlotPayload,
} from '@/types/timetable';

export async function getClassTimetable(classId: number): Promise<ClassTimetable> {
  const { data } = await api.get(API_ENDPOINTS.TIMETABLE.CLASS(classId));
  return data.data ?? data;
}

/**
 * Create a class from the timetable screen (name + grade only).
 * Distinct from class.api's createClass, which needs subject + academic year.
 */
export async function createTimetableClass(
  payload: CreateTimetableClassPayload,
): Promise<{ id: number; name: string; gradeLevel: number }> {
  const { data } = await api.post(API_ENDPOINTS.TIMETABLE.CLASSES, payload);
  return data.data ?? data;
}

export async function createSlot(
  classId: number,
  payload: CreateSlotPayload,
): Promise<TimetableSlot> {
  const { data } = await api.post(API_ENDPOINTS.TIMETABLE.SLOTS(classId), payload);
  return data.data ?? data;
}

export async function updateSlot(
  classId: number,
  slotId: number,
  payload: UpdateSlotPayload,
): Promise<TimetableSlot> {
  const { data } = await api.put(API_ENDPOINTS.TIMETABLE.SLOT_BY_ID(classId, slotId), payload);
  return data.data ?? data;
}

export async function cancelSlot(classId: number, slotId: number): Promise<void> {
  await api.delete(API_ENDPOINTS.TIMETABLE.SLOT_BY_ID(classId, slotId));
}

export async function clearTimetable(classId: number): Promise<{ deleted: number }> {
  const { data } = await api.delete(API_ENDPOINTS.TIMETABLE.CLASS(classId));
  return data.data ?? data;
}

export async function checkConflicts(
  payload: CheckConflictsPayload,
): Promise<ConflictCheckResult> {
  const { data } = await api.post(API_ENDPOINTS.TIMETABLE.CHECK_CONFLICTS, payload);
  return data.data ?? data;
}

export async function importTimetable(
  classId: number,
  file: File,
): Promise<ImportTimetableResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await api.post(API_ENDPOINTS.TIMETABLE.IMPORT(classId), formData);
  return data.data ?? data;
}

export function getImportTemplateUrl(): string {
  return API_ENDPOINTS.TIMETABLE.IMPORT_TEMPLATE;
}
