import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type {
  LinkedChild,
  ChildResultsResponse,
  ChildDashboardData,
} from '@/types/parent';

export async function getChildren(): Promise<LinkedChild[]> {
  const { data } = await api.get(API_ENDPOINTS.PARENT.CHILDREN);
  return data.data;
}

export async function getChildResults(
  childId: number,
  params: { page?: number; limit?: number; sort?: string; order?: string; subjectId?: number } = {},
): Promise<ChildResultsResponse> {
  const { data } = await api.get(API_ENDPOINTS.PARENT.CHILD_RESULTS(childId), { params });
  return { data: data.data, pagination: data.pagination };
}

export async function getChildDashboard(
  childId: number,
  subjectId?: number,
): Promise<ChildDashboardData> {
  const params = subjectId ? { subjectId } : {};
  const { data } = await api.get(API_ENDPOINTS.PARENT.CHILD_DASHBOARD(childId), { params });
  return data.data;
}

