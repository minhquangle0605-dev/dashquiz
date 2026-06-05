import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';

interface ServerResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type ExportFormat = 'pdf' | 'excel';
export type ExportReportType =
  | 'exam_summary'
  | 'question_analysis'
  | 'student_results'
  | 'exam_results'
  | 'class_results';

export interface ExportResult {
  id: number;
  filename: string;
  format: string;
  size: number;
  downloadUrl: string;
  expiresIn: string;
  createdAt: string;
}

export interface ExportHistoryItem {
  id: number;
  reportType: string;
  targetId: number | null;
  format: string;
  status: string;
  createdAt: string;
}

export async function exportReport(payload: {
  format: ExportFormat;
  reportType: ExportReportType;
  examId?: number;
  classId?: number;
  title?: string;
}): Promise<ExportResult> {
  const { data } = await api.post<ServerResponse<ExportResult>>(
    API_ENDPOINTS.REPORTS.EXPORT,
    payload,
  );
  return data.data;
}

export async function getExportHistory(): Promise<ExportHistoryItem[]> {
  const { data } = await api.get<ServerResponse<ExportHistoryItem[]>>(
    API_ENDPOINTS.REPORTS.HISTORY,
  );
  return data.data;
}

export async function getReportDownloadUrl(
  id: number,
): Promise<{ downloadUrl: string; format: string; expiresIn: string }> {
  const { data } = await api.get<ServerResponse<{ downloadUrl: string; format: string; expiresIn: string }>>(
    API_ENDPOINTS.REPORTS.DOWNLOAD(id),
  );
  return data.data;
}
