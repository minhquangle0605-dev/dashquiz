import api from './api';
import { API_ENDPOINTS } from '@/utils/constants';
import type { QuestionQuality, QuestionReviewData, ReviewStatus } from '@/types/exam';

interface ServerResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export async function getQuestionQuality(questionId: number): Promise<QuestionQuality> {
  const { data } = await api.get<ServerResponse<QuestionQuality>>(
    API_ENDPOINTS.QUESTIONS.QUALITY(questionId),
  );
  return data.data;
}

export async function setQuestionReview(
  questionId: number,
  payload: { status: ReviewStatus; qualityFlag?: string | null; comment?: string | null },
): Promise<QuestionReviewData> {
  const { data } = await api.put<ServerResponse<QuestionReviewData>>(
    API_ENDPOINTS.QUESTIONS.REVIEW_STATUS(questionId),
    payload,
  );
  return data.data;
}
