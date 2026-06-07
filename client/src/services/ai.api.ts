import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';

interface ServerResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface MatchingDistractorRequest {
  pairs: Array<{ left: string; right: string }>;
  questionContent?: string;
  subjectName?: string;
}

export async function generateMatchingDistractor(
  payload: MatchingDistractorRequest,
): Promise<string> {
  const { data } = await api.post<ServerResponse<{ distractor: string }>>(
    API_ENDPOINTS.AI.MATCHING_DISTRACTOR,
    payload,
  );
  return data.data.distractor;
}
